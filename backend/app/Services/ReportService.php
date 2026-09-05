<?php

namespace BitApps\BitConnect\Services;

// Prevent direct script access
if (!\defined('ABSPATH')) {
    exit;
}

use BitApps\BitConnect\Config;
use BitApps\BitConnect\Deps\BitApps\WPDatabase\Connection;
use BitApps\BitConnect\Deps\BitApps\WPDatabase\Model;
use BitApps\BitConnect\Deps\BitApps\WPKit\Hooks\Hooks;
use BitApps\BitConnect\Enum\AdminSettings;
use BitApps\BitConnect\Enum\ReportReasons;
use BitApps\BitConnect\Enum\ReportStatus;
use BitApps\BitConnect\Model\Report;
use InvalidArgumentException;
use WP_Comment;
use WP_Post;

/**
 * Filing and resolving reports.
 *
 * Everything that decides whether a report is allowed lives here rather than in
 * the controller, because the same rules have to hold whoever asks: the portal,
 * a future bulk tool, WP-CLI.
 */
final class ReportService
{
    public const TARGET_POST = 'post';

    public const TARGET_COMMENT = 'comment';

    /**
     * Pending reports needed before content is hidden, when nobody has chosen.
     */
    public const DEFAULT_AUTO_HIDE_THRESHOLD = 2;

    /**
     * Hard cap on rows read to build the queue.
     *
     * Pending reports are self-limiting in practice — they exist only until
     * someone reviews them — but an unbounded read is still an unbounded read.
     * When this bites, the response says so rather than quietly showing a
     * shorter queue than there is.
     */
    private const QUEUE_ROW_CAP = 1000;

    /**
     * Transient holding the queue badge's count.
     */
    private const PENDING_COUNT_KEY = 'bc_reports_pending_targets';

    /**
     * How many pending reports it takes to hide something automatically.
     *
     * Two rather than one. On one, a single member who dislikes a post takes it
     * out of sight on their own and nothing stands between them and the button —
     * the rest of this class's rules bound who may report and how often, not what
     * one report is worth. Two means a second person has to agree before anyone's
     * words disappear, which is the cheapest check there is on the reporter who
     * is simply wrong.
     *
     * Forums that would rather act on the first report can set it back to one in
     * Settings; the point is that it is now a decision someone made.
     *
     * Read from admin settings, falling back to the standalone option this used
     * to live in so a site that set it by WP-CLI does not silently change
     * behaviour on upgrade.
     *
     * Filter: bit_connect_report_auto_hide_threshold
     */
    public static function autoHideThreshold(): int
    {
        $settings = Config::getOption(AdminSettings::OPTION_NAME->value, []);
        $configured = \is_array($settings) ? ($settings['moderation']['autoHideThreshold'] ?? null) : null;

        $stored = $configured === null
            ? (int) get_option('bit_connect_report_auto_hide_threshold', self::DEFAULT_AUTO_HIDE_THRESHOLD)
            : (int) $configured;

        return max(1, (int) Hooks::applyFilter('bit_connect_report_auto_hide_threshold', $stored));
    }

    /**
     * Files a report, or explains why it cannot be filed.
     *
     * @throws InvalidArgumentException with a message meant for the reporter
     *
     * @return array{pending: int, should_hide: bool}
     */
    public static function file(string $targetType, int $targetId, string $reason, string $details = ''): array
    {
        $reporterId = get_current_user_id();

        if ($reporterId <= 0) {
            throw new InvalidArgumentException(__('You must be logged in to report anything.', 'bit-connect'));
        }

        $reasonCase = ReportReasons::tryFrom($reason);

        if ($reasonCase === null) {
            throw new InvalidArgumentException(__('That is not a reason this forum recognises.', 'bit-connect'));
        }

        $details = trim($details);

        if (ReportReasons::requiresDetails($reasonCase) && $details === '') {
            throw new InvalidArgumentException(__('Please say what is wrong with it.', 'bit-connect'));
        }

        $author = self::targetAuthor($targetType, $targetId);

        if ($author === null) {
            throw new InvalidArgumentException(__('That content no longer exists.', 'bit-connect'));
        }

        if ($author === $reporterId) {
            throw new InvalidArgumentException(__('You cannot report your own content.', 'bit-connect'));
        }

        if (Report::alreadyReported($reporterId, $targetType, $targetId)) {
            throw new InvalidArgumentException(__('You have already reported this.', 'bit-connect'));
        }

        if (!ReportRateLimiter::isAllowed($reporterId)) {
            throw new InvalidArgumentException(ReportRateLimiter::errorMessage());
        }

        $stored = Report::insert(
            [
                'target_type'   => $targetType,
                'target_id'     => $targetId,
                'target_author' => $author,
                'reporter_id'   => $reporterId,
                'reason'        => $reasonCase->value,
                'details'       => $details === '' ? null : $details,
                'status'        => ReportStatus::PENDING->value,
            ]
        );

        // insert() answers false rather than throwing. Without this the caller
        // is told the report was filed while nothing was written — which is
        // exactly how a duplicate-column bug in this method went unnoticed
        // through a green test run.
        if ($stored === false) {
            throw new InvalidArgumentException(__('Your report could not be saved. Please try again.', 'bit-connect'));
        }

        // Only after the row is stored, so a rejected report costs the reporter
        // nothing.
        ReportRateLimiter::consume($reporterId);
        self::flushPendingCount();

        $pending = Report::pendingCount($targetType, $targetId);

        return [
            'pending'     => $pending,
            'should_hide' => self::shouldAutoHide($targetType, $targetId, $author, $pending),
        ];
    }

    /**
     * Whether this target should now be hidden from public view.
     *
     * This plugin never hides anything on its own: it takes reports, counts
     * them and shows them in the moderation queue, and a person decides. Acting
     * on a count without a person having looked is a behaviour the Bit Connect
     * Pro add-on adds, through the extension point below — the staff exemption
     * and the threshold comparison live there with it.
     */
    public static function shouldAutoHide(string $targetType, int $targetId, int $author, ?int $pending = null): bool
    {
        return ProFeatures::autoHideOnReports($targetType, $targetId, $author, $pending);
    }

    /**
     * Everyone still waiting to hear what happened to one target.
     *
     * Must be read *before* resolveTarget(): pendingFor() answers with open
     * reports only, so by the time a decision has been recorded there is nobody
     * left to tell. Getting this order wrong does not fail — it silently
     * notifies no one, which is the hardest kind of bug to notice in a feature
     * whose whole job is to send things.
     *
     * @return array<int, int>
     */
    public static function pendingReporterIds(string $targetType, int $targetId): array
    {
        $rows = Report::pendingFor($targetType, $targetId);

        // get() answers with a bare Model instead of a list when a limit of one
        // matched exactly one row. pendingFor() sets no limit, so this is a
        // guard rather than a live case — but casting a Model to an array yields
        // the model's own properties ($table, $casts…) and not the row, and the
        // failure mode would be an empty recipient list that looks deliberate.
        $rows = $rows instanceof Model ? [$rows] : (array) $rows;

        $ids = array_map(static fn ($row): int => (int) $row->reporter_id, $rows);

        return array_values(array_unique(array_filter($ids, static fn (int $id): bool => $id > 0)));
    }

    /**
     * Closes every pending report on one target with the same answer.
     *
     * Reports are resolved per target rather than per row: a moderator reviews
     * the content once, and five people reporting the same comment is one
     * decision, not five.
     *
     * @return int how many reports were closed
     */
    public static function resolveTarget(string $targetType, int $targetId, ReportStatus $status, string $note = ''): int
    {
        if ($status === ReportStatus::PENDING) {
            throw new InvalidArgumentException('A report cannot be resolved as still pending.');
        }

        $pending = Report::pendingFor($targetType, $targetId);
        $count = \count((array) $pending);

        if ($count === 0) {
            return 0;
        }

        // Written through Connection rather than the model layer, which cannot run
        // this: QueryBuilder::update() builds a statement and returns $this
        // without executing (exec() is private), and save() on a fetched row
        // emits a mismatched column/value list. Both fail silently enough that
        // the queue simply never emptied.

        $updated = Connection::update(
            Config::withDBPrefix('reports'),
            [
                'status'          => $status->value,
                'resolved_by'     => get_current_user_id(),
                'resolved_at'     => current_time('mysql', true),
                'resolution_note' => $note === '' ? null : $note,
                'updated_at'      => current_time('mysql', true),
            ],
            [
                'target_type' => $targetType,
                'target_id'   => $targetId,
                'status'      => ReportStatus::PENDING->value,
            ],
            ['%s', '%d', '%s', '%s', '%s'],
            ['%s', '%d', '%s']
        );

        if ($updated === false) {
            throw new InvalidArgumentException(__('The reports could not be updated. Please try again.', 'bit-connect'));
        }

        self::flushPendingCount();

        return (int) $updated;
    }

    /**
     * The moderation queue: one entry per reported item, not per report.
     *
     * Grouped in PHP rather than by SQL because each entry needs the reasons and
     * reporters behind it, which a GROUP BY would have to re-query for anyway,
     * and the pending set is small by nature.
     *
     * @param array{status?: string, page?: int, per_page?: int} $filters
     *
     * @return array{data: array<int, array<string, mixed>>, pagination: array<string, int>, truncated: bool}
     */
    public static function queue(array $filters = []): array
    {
        $page = max(1, (int) ($filters['page'] ?? 1));
        $perPage = min(100, max(1, (int) ($filters['per_page'] ?? 20)));
        $status = (string) ($filters['status'] ?? ReportStatus::PENDING->value);

        $rows = (array) Report::where('status', $status)
            ->orderBy('created_at')
            ->desc()
            ->take((string) self::QUEUE_ROW_CAP)
            ->get();

        // Every name and every reported item is fetched once, up front, instead
        // of one query per row deep inside the loop. A queue of 200 reports over
        // 60 topics was ~260 round trips to build one page; this is three.
        self::primeQueueCaches($rows);

        $groups = [];

        foreach ($rows as $row) {
            $key = $row->target_type . ':' . $row->target_id;

            if (!isset($groups[$key])) {
                $groups[$key] = [
                    'target_type'   => (string) $row->target_type,
                    'target_id'     => (int) $row->target_id,
                    'target_author' => (int) $row->target_author,
                    'count'         => 0,
                    'reasons'       => [],
                    'reporters'     => [],
                    'details'       => [],
                    'first_at'      => (string) $row->created_at,
                    'latest_at'     => (string) $row->created_at,
                ];
            }

            ++$groups[$key]['count'];
            $reason = (string) $row->reason;
            $groups[$key]['reasons'][$reason] = ($groups[$key]['reasons'][$reason] ?? 0) + 1;

            $reporter = get_userdata((int) $row->reporter_id);
            $groups[$key]['reporters'][] = [
                'id'   => (int) $row->reporter_id,
                'name' => $reporter ? $reporter->display_name : '',
            ];

            if ($row->details !== null && (string) $row->details !== '') {
                $groups[$key]['details'][] = (string) $row->details;
            }

            // Rows arrive newest-first, so the last one seen is the oldest.
            $groups[$key]['first_at'] = (string) $row->created_at;
        }

        $entries = array_values(array_map([self::class, 'hydrateQueueEntry'], $groups));
        $total = \count($entries);

        return [
            'data'       => \array_slice($entries, ($page - 1) * $perPage, $perPage),
            'pagination' => [
                'total'        => $total,
                'per_page'     => $perPage,
                'current_page' => $page,
                'total_pages'  => (int) ceil($total / $perPage),
            ],
            'truncated' => \count($rows) >= self::QUEUE_ROW_CAP,
        ];
    }

    /**
     * How many separate items are waiting for a moderator.
     *
     * Items, not rows: five people reporting one comment is one thing to look
     * at, and it is the queue's own unit — a badge reading 5 over a queue with
     * one entry in it is worse than no badge.
     *
     * Cached because this runs on every admin page load for every moderator,
     * and dropped the moment a report is filed or resolved, so the number is
     * only ever stale for people who changed nothing.
     */
    public static function pendingTargetCount(): int
    {
        $cached = get_transient(self::PENDING_COUNT_KEY);

        if ($cached !== false) {
            return (int) $cached;
        }


        $table = Config::withDBPrefix('reports');
        $count = (int) Connection::get_var(
            Connection::prepare(
                "SELECT COUNT(DISTINCT target_type, target_id) FROM {$table} WHERE status = %s",
                ReportStatus::PENDING->value
            )
        );

        set_transient(self::PENDING_COUNT_KEY, $count, HOUR_IN_SECONDS);

        return $count;
    }

    /**
     * Drops the cached badge count. Called wherever the queue changes.
     */
    public static function flushPendingCount(): void
    {
        delete_transient(self::PENDING_COUNT_KEY);
    }

    /**
     * The author of a target, or null when it no longer exists.
     */
    public static function targetAuthor(string $targetType, int $targetId): ?int
    {
        if ($targetType === self::TARGET_COMMENT) {
            $comment = get_comment($targetId);

            return $comment instanceof WP_Comment ? (int) $comment->user_id : null;
        }

        $post = get_post($targetId);

        return $post instanceof WP_Post ? (int) $post->post_author : null;
    }

    /**
     * Whether a target type is one this forum accepts reports about.
     */
    public static function isValidTargetType(string $targetType): bool
    {
        return \in_array($targetType, [self::TARGET_POST, self::TARGET_COMMENT], true);
    }

    /**
     * Warms the caches every later get_userdata()/get_post()/get_comment() hits.
     *
     * WordPress answers those from its object cache once the id is in it, so
     * nothing downstream has to change — the calls stay where they read best and
     * simply stop going to the database.
     *
     * @param array<int, mixed> $rows
     */
    private static function primeQueueCaches(array $rows): void
    {
        $userIds = [];
        $postIds = [];
        $commentIds = [];

        foreach ($rows as $row) {
            $userIds[(int) $row->reporter_id] = true;
            $userIds[(int) $row->target_author] = true;

            if ((string) $row->target_type === self::TARGET_COMMENT) {
                $commentIds[(int) $row->target_id] = true;
            } else {
                $postIds[(int) $row->target_id] = true;
            }
        }

        unset($userIds[0]);

        if ($userIds !== []) {
            // cache_results is on by default, which is the whole point of the
            // call: the rows land in the user cache and get_userdata() is free.
            get_users(['include' => array_keys($userIds), 'fields' => 'all_with_meta']);
        }

        if ($postIds !== []) {
            _prime_post_caches(array_keys($postIds), false, false);
        }

        if ($commentIds !== []) {
            _prime_comment_caches(array_keys($commentIds), false);
        }
    }

    /**
     * Fills in what the queue needs to show about the reported item itself.
     *
     * @param array<string, mixed> $group
     *
     * @return array<string, mixed>
     */
    private static function hydrateQueueEntry(array $group): array
    {
        $type = (string) $group['target_type'];
        $id = (int) $group['target_id'];
        $author = get_userdata((int) $group['target_author']);

        $excerpt = '';
        $title = '';
        $exists = false;
        $link = '';

        if ($type === self::TARGET_COMMENT) {
            $comment = get_comment($id);
            $exists = $comment instanceof WP_Comment;
            $excerpt = $exists ? ActivityLogService::excerpt($comment->comment_content) : '';
            $link = $exists ? (string) get_comment_link($comment) : '';
        } else {
            $post = get_post($id);
            $exists = $post instanceof WP_Post;
            $title = $exists ? (string) $post->post_title : '';
            $excerpt = $exists ? ActivityLogService::excerpt($post->post_content) : '';
            $link = $exists ? (string) get_permalink($post) : '';
        }

        $group['target_author_name'] = $author ? $author->display_name : '';
        $group['exists'] = $exists;
        $group['title'] = $title;
        $group['excerpt'] = $excerpt;
        $group['link'] = $link;
        // Reasons are stored as slugs; the label belongs with them so the queue
        // does not have to keep its own copy of the enum.
        $group['reason_labels'] = ReportReasons::labels();

        return $group;
    }
}
