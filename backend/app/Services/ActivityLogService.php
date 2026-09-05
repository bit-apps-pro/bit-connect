<?php

namespace BitApps\BitConnect\Services;

// Prevent direct script access
if (!\defined('ABSPATH')) {
    exit;
}

use BitApps\BitConnect\Enum\ActivityActions;
use BitApps\BitConnect\Model\ActivityLog;

/**
 * Records and reads what people did to content they did not write.
 *
 * The rule every call site follows: log only when the actor is not the author.
 * A member editing their own reply needs no log — the "(edited)" note on the
 * comment already says so, and recording every self-edit would bury the handful
 * of rows that matter under thousands that do not.
 *
 * That check cannot live in PermissionService. Those are pure predicates, called
 * speculatively — currentUserCapabilities() asks all fourteen on every request —
 * so a log write hidden inside one would fire for questions nobody acted on.
 * The controllers decide, after the write succeeds.
 */
final class ActivityLogService
{
    public const TARGET_POST = 'post';

    public const TARGET_COMMENT = 'comment';

    /**
     * The actor id kept for something the plugin did on its own.
     *
     * Zero because no user did it. It is a value record() refuses, which is the
     * point: a row with no actor can only be written through recordAsSystem(),
     * so nothing reaches it by forgetting to log in.
     */
    public const SYSTEM_ACTOR = 0;

    /**
     * How much of the before/after text is kept.
     *
     * Enough to see what changed in a diff, capped so the table cannot be grown
     * without bound by someone editing a very long topic repeatedly.
     */
    private const EXCERPT_LIMIT = 2000;

    /**
     * Writes one row. Silently does nothing when there is no actor.
     *
     * @param array<string, mixed> $context free-form detail, stored as JSON
     */
    public static function record(
        ActivityActions $action,
        string $targetType,
        int $targetId,
        int $targetAuthor,
        array $context = [],
        ?string $reason = null
    ): void {
        $actorId = get_current_user_id();

        if ($actorId <= 0) {
            return;
        }

        self::write($actorId, $action, $targetType, $targetId, $targetAuthor, $context, $reason);
    }

    /**
     * Records something the plugin did by rule rather than by decision.
     *
     * The auto-hide is the case this exists for. A report crossing the threshold
     * takes content out of sight, and recording that against the reporter reads
     * as though they exercised a power they do not have — the whole point of a
     * threshold is that nobody chose. record() cannot express it: it reads the
     * current user, and drops the row when there is not one.
     *
     * @param array<string, mixed> $context
     */
    public static function recordAsSystem(
        ActivityActions $action,
        string $targetType,
        int $targetId,
        int $targetAuthor,
        array $context = [],
        ?string $reason = null
    ): void {
        self::write(self::SYSTEM_ACTOR, $action, $targetType, $targetId, $targetAuthor, $context, $reason);
    }

    /**
     * Records an action only when the actor is not the author.
     *
     * The one guard every call site would otherwise repeat, in the one place it
     * can be got wrong once instead of six times.
     *
     * @param array<string, mixed> $context
     */
    public static function recordIfNotAuthor(
        ActivityActions $action,
        string $targetType,
        int $targetId,
        int $targetAuthor,
        array $context = [],
        ?string $reason = null
    ): void {
        if ($targetAuthor === get_current_user_id()) {
            return;
        }

        self::record($action, $targetType, $targetId, $targetAuthor, $context, $reason);
    }

    /**
     * Trims text for storage in the context blob.
     *
     * Marks the cut rather than ending mid-sentence with no sign, so a reader
     * knows the diff they are looking at is partial.
     */
    public static function excerpt(?string $text): string
    {
        $text = (string) $text;

        if (mb_strlen($text) <= self::EXCERPT_LIMIT) {
            return $text;
        }

        return mb_substr($text, 0, self::EXCERPT_LIMIT) . '… [truncated]';
    }

    /**
     * The admin feed: newest first, filterable, paginated.
     *
     * @param array{actor?: int, action?: string, target_type?: string, target_id?: int, page?: int, per_page?: int} $filters
     *
     * @return array{data: array<int, array<string, mixed>>, pagination: array<string, int>}
     */
    public static function feed(array $filters = []): array
    {
        $page = max(1, (int) ($filters['page'] ?? 1));
        $perPage = min(100, max(1, (int) ($filters['per_page'] ?? 20)));

        $query = ActivityLog::select(['*']);

        if (!empty($filters['actor'])) {
            $query = $query->where('actor_id', (int) $filters['actor']);
        }

        if (!empty($filters['action'])) {
            $query = $query->where('action', $filters['action']);
        }

        if (!empty($filters['target_type'])) {
            $query = $query->where('target_type', $filters['target_type']);
        }

        // The one search that answers "what has been done to this?" — the
        // history of a single topic or comment, which is the question a
        // moderator arrives with when someone disputes what happened to theirs.
        if (!empty($filters['target_id'])) {
            $query = $query->where('target_id', (int) $filters['target_id']);
        }

        // Newest first: orderBy() only names the column, desc() sets the
        // direction — it takes no second argument.
        $result = $query->orderBy('created_at')->desc()->paginate($page, $perPage);

        return [
            'data'       => array_map([self::class, 'format'], (array) ($result['data'] ?? [])),
            'pagination' => [
                'total'        => (int) ($result['total'] ?? 0),
                'per_page'     => $perPage,
                'current_page' => $page,
                'total_pages'  => (int) ($result['pages'] ?? 0),
            ],
        ];
    }

    /**
     * The single insert both entry points go through.
     *
     * @param array<string, mixed> $context
     */
    private static function write(
        int $actorId,
        ActivityActions $action,
        string $targetType,
        int $targetId,
        int $targetAuthor,
        array $context = [],
        ?string $reason = null
    ): void {
        if ($targetId <= 0) {
            return;
        }

        ActivityLog::insert(
            [
                'actor_id'      => $actorId,
                'action'        => $action->value,
                'target_type'   => $targetType,
                'target_id'     => $targetId,
                'target_author' => $targetAuthor,
                'reason'        => $reason,
                'context'       => $context === [] ? null : wp_json_encode($context),
            ]
        );
    }

    /**
     * Shapes one row for the API.
     *
     * Names are resolved at read time and may come back empty: an actor whose
     * account was deleted still leaves their id on the row, and the log would be
     * worth little if it quietly dropped the entries belonging to them.
     *
     * @param mixed $row
     *
     * @return array<string, mixed>
     */
    private static function format($row): array
    {
        $action = ActivityActions::tryFrom((string) $row->action);
        $actor = get_userdata((int) $row->actor_id);
        $targetAuthor = get_userdata((int) $row->target_author);
        $context = \is_string($row->context) ? json_decode($row->context, true) : null;

        return [
            'id'     => (int) $row->id,
            'action' => (string) $row->action,
            // phpcs:ignore WordPress.WP.I18n.NonSingularStringLiteralText -- labels are English literals defined in #[Label] attributes; translated here at the read site
            'action_label' => $action ? __($action->label(), 'bit-connect') : (string) $row->action,
            'actor'        => [
                'id'   => (int) $row->actor_id,
                'name' => $actor ? $actor->display_name : '',
                'slug' => $actor ? ProfileSlugService::slugFor((int) $row->actor_id) : '',
                // An empty name means two different things — a deleted account,
                // or nobody at all — and the screen has to be able to tell them
                // apart. Without this an auto-hide reads as "(deleted account)",
                // which invents a person where the rule acted.
                'is_system' => (int) $row->actor_id === self::SYSTEM_ACTOR,
            ],
            'target' => [
                'type'   => (string) $row->target_type,
                'id'     => (int) $row->target_id,
                'author' => [
                    'id'   => (int) $row->target_author,
                    'name' => $targetAuthor ? $targetAuthor->display_name : '',
                ],
                // False once the row it describes is gone, which is exactly the
                // case this table exists to survive. The UI shows a title from
                // the context blob instead of a dead link.
                'exists' => self::targetExists((string) $row->target_type, (int) $row->target_id),
            ],
            'reason'     => $row->reason === null ? '' : (string) $row->reason,
            'context'    => \is_array($context) ? $context : [],
            'created_at' => (string) $row->created_at,
        ];
    }

    private static function targetExists(string $targetType, int $targetId): bool
    {
        if ($targetType === self::TARGET_COMMENT) {
            return get_comment($targetId) !== null;
        }

        return get_post($targetId) !== null;
    }
}
