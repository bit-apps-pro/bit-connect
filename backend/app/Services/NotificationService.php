<?php

namespace BitApps\BitConnect\Services;

// Prevent direct script access
if (!\defined('ABSPATH')) {
    exit;
}

use BitApps\BitConnect\Config;
use BitApps\BitConnect\Deps\BitApps\WPDatabase\Connection;
use BitApps\BitConnect\Deps\BitApps\WPKit\Hooks\Hooks;
use BitApps\BitConnect\Enum\NotificationSettings;
use BitApps\BitConnect\Enum\NotificationTypes;
use BitApps\BitConnect\Model\Notification;

/**
 * The one way anything in this plugin tells a member something happened.
 *
 * Call sites pass an event; this decides who hears it, on which channels, and
 * whether it is news or more of something they already have. Nothing above this
 * line asks about follows, preferences or duplicates — that is the whole point
 * of there being a dispatcher.
 *
 * Two rules are enforced here and nowhere else, because they are the two every
 * call site would otherwise re-implement and one of them would get wrong:
 *
 *   1. **Never notify the actor about their own action.** Replying to your own
 *      topic is not news.
 *   2. **One event, one row per person.** A comment that both replies to you and
 *      mentions you is one thing that happened. `exclude` is how the second
 *      dispatch is told about the first.
 *
 * On `emailed_at`: null means "this row still owes an email". A row nobody wants
 * mailed is stamped at insert rather than left null, so the digest sweep's index
 * scan is exactly the set of rows it has work for, and never a filter over
 * everything ever written.
 */
final class NotificationService
{
    public const TARGET_TOPIC = 'topic';

    public const TARGET_COMMENT = 'comment';

    public const TARGET_REPORT = 'report';

    public const TARGET_USER = 'user';

    /**
     * The actor id kept for something the forum did on its own.
     *
     * Zero because no person did it — the auto-hide that fires when reports
     * cross the threshold is the rule acting, and naming a moderator would
     * credit someone with a decision they never made. Mirrors
     * ActivityLogService::SYSTEM_ACTOR, and for the same reason.
     */
    public const SYSTEM_ACTOR = 0;

    private const UNREAD_COUNT_KEY = 'bit_connect_unread_notifications_';

    /**
     * Sends an event, attributed to whoever is logged in.
     *
     * @param array<string, mixed> $context   stored as JSON; keep enough in it to
     *                                        render the row after its target is deleted
     * @param null|array<int, int> $recipients explicit list, or null to derive from the type
     * @param array<int, int>      $exclude    people already told about this same event
     *
     * @return int how many notifications were written
     */
    public static function dispatch(
        NotificationTypes $type,
        string $targetType,
        int $targetId,
        array $context = [],
        ?int $topicId = null,
        ?array $recipients = null,
        array $exclude = []
    ): int {
        return self::send(
            get_current_user_id(),
            $type,
            $targetType,
            $targetId,
            $context,
            $topicId,
            $recipients,
            $exclude
        );
    }

    /**
     * Sends an event nobody chose.
     *
     * An ordinary dispatch() cannot express this: it reads the current user, and
     * an auto-hide fires on the request of whoever tripped the threshold — the
     * reporter, who did not decide anything.
     *
     * @param array<string, mixed> $context
     * @param null|array<int, int> $recipients
     * @param array<int, int>      $exclude
     */
    public static function dispatchAsSystem(
        NotificationTypes $type,
        string $targetType,
        int $targetId,
        array $context = [],
        ?int $topicId = null,
        ?array $recipients = null,
        array $exclude = []
    ): int {
        return self::send(
            self::SYSTEM_ACTOR,
            $type,
            $targetType,
            $targetId,
            $context,
            $topicId,
            $recipients,
            $exclude
        );
    }

    /**
     * How many notifications this member has not read.
     *
     * The number behind the bell, so it runs on every portal page load for every
     * logged-in member. Cached per member and dropped whenever their own set
     * changes, which means it is only ever stale for people nothing happened to.
     */
    public static function unreadCount(int $userId): int
    {
        if ($userId <= 0) {
            return 0;
        }

        $cached = get_transient(self::UNREAD_COUNT_KEY . $userId);

        if ($cached !== false) {
            return (int) $cached;
        }


        $table = Config::withDBPrefix('notifications');
        $count = (int) Connection::get_var(
            Connection::prepare(
                "SELECT COUNT(*) FROM {$table} WHERE user_id = %d AND read_at IS NULL",
                $userId
            )
        );

        set_transient(self::UNREAD_COUNT_KEY . $userId, $count, HOUR_IN_SECONDS);

        return $count;
    }

    public static function flushUnreadCount(int $userId): void
    {
        delete_transient(self::UNREAD_COUNT_KEY . $userId);
    }

    /**
     * One member's notifications, newest first.
     *
     * @param array{page?: int, per_page?: int, unread?: bool} $filters
     *
     * @return array{data: array<int, array<string, mixed>>, pagination: array<string, int>, unread: int}
     */
    public static function feed(int $userId, array $filters = []): array
    {
        $page = max(1, (int) ($filters['page'] ?? 1));
        $perPage = min(50, max(1, (int) ($filters['per_page'] ?? 20)));
        $unreadOnly = !empty($filters['unread']);

        if ($userId <= 0) {
            return [
                'data'       => [],
                'pagination' => ['total' => 0, 'per_page' => $perPage, 'current_page' => $page, 'total_pages' => 0],
                'unread'     => 0,
            ];
        }

        $result = Notification::feedFor($userId, $page, $perPage, $unreadOnly);
        // Already a list: feedFor() normalises the one page size where the query
        // builder answers with a bare Model instead.
        $rows = $result['data'];

        self::primeCaches($rows);

        return [
            'data'       => array_map([self::class, 'format'], $rows),
            'pagination' => [
                'total'        => (int) ($result['total'] ?? 0),
                'per_page'     => $perPage,
                'current_page' => $page,
                'total_pages'  => (int) ($result['pages'] ?? 0),
            ],
            // Sent alongside the page so the bell and the list can never disagree
            // about the badge after a mark-as-read.
            'unread' => self::unreadCount($userId),
        ];
    }

    /**
     * Marks notifications read. Returns how many changed.
     *
     * Scoped to the member every time: `user_id` is in the WHERE clause even
     * when explicit ids are given, so a guessed id belonging to someone else
     * matches nothing rather than marking their mail read.
     *
     * @param array<int, int> $ids empty with $all false is a no-op
     */
    public static function markRead(int $userId, array $ids = [], bool $all = false): int
    {
        if ($userId <= 0 || (!$all && $ids === [])) {
            return 0;
        }


        $table = Config::withDBPrefix('notifications');
        $now = current_time('mysql', true);

        if ($all) {
            $updated = Connection::query(
                Connection::prepare(
                    "UPDATE {$table} SET read_at = %s, updated_at = %s WHERE user_id = %d AND read_at IS NULL",
                    $now,
                    $now,
                    $userId
                )
            );
        } else {
            $ids = array_values(array_filter(array_map('intval', $ids), static fn (int $id): bool => $id > 0));

            if ($ids === []) {
                return 0;
            }

            $placeholders = implode(',', array_fill(0, \count($ids), '%d'));

            $updated = Connection::query(
                Connection::prepare(
                    "UPDATE {$table} SET read_at = %s, updated_at = %s
                     WHERE user_id = %d AND read_at IS NULL AND id IN ({$placeholders})",
                    $now,
                    $now,
                    $userId,
                    ...$ids
                )
            );
        }

        if ($updated === false) {
            return 0;
        }

        self::flushUnreadCount($userId);

        return (int) $updated;
    }

    /**
     * Deletes read notifications past the retention age.
     *
     * Read only. An unread row is never pruned however old it is — nobody has
     * seen it, and deleting it would make the forum silently drop the one thing
     * it exists to deliver.
     *
     * @return int rows removed
     */
    public static function pruneRead(?int $retentionDays = null): int
    {
        $days = $retentionDays ?? NotificationSettings::retentionDays(NotificationPreferences::settings());


        $table = Config::withDBPrefix('notifications');
        $cutoff = gmdate('Y-m-d H:i:s', time() - ($days * DAY_IN_SECONDS));

        $deleted = Connection::query(
            Connection::prepare(
                "DELETE FROM {$table} WHERE read_at IS NOT NULL AND read_at < %s",
                $cutoff
            )
        );

        return $deleted === false ? 0 : (int) $deleted;
    }

    /**
     * Everything addressed to a member, dropped with their account.
     */
    public static function purgeUser(int $userId): void
    {
        Connection::delete(Config::withDBPrefix('notifications'), ['user_id' => $userId], ['%d']);
        self::flushUnreadCount($userId);
    }

    /**
     * The single path both entry points go through.
     *
     * @param array<string, mixed> $context
     * @param null|array<int, int> $recipients
     * @param array<int, int>      $exclude
     */
    private static function send(
        int $actorId,
        NotificationTypes $type,
        string $targetType,
        int $targetId,
        array $context,
        ?int $topicId,
        ?array $recipients,
        array $exclude
    ): int {
        if ($targetId <= 0 || !NotificationSettings::isEnabled(NotificationPreferences::settings())) {
            return 0;
        }

        $candidates = $recipients ?? self::resolveRecipients($type, $targetType, $targetId, $topicId);

        /**
         * Lets Pro and third parties add or remove recipients without forking
         * this method. Filtered before the actor and exclusions are applied, so
         * a listener cannot accidentally reintroduce the author of the action.
         *
         * @param array<int, int>      $candidates
         * @param string               $type
         * @param array<string, mixed> $context
         */
        $candidates = (array) Hooks::applyFilter(
            'bit_connect_notification_recipients',
            $candidates,
            $type->value,
            $context
        );

        $excluded = array_map('intval', $exclude);

        // The actor last and unconditionally: a filter that added them back
        // would otherwise be able to notify someone about their own reply.
        if ($actorId > 0) {
            $excluded[] = $actorId;
        }

        $written = 0;

        foreach (self::normalizeIds($candidates, $excluded) as $userId) {
            if (self::deliver($userId, $actorId, $type, $targetType, $targetId, $context, $topicId)) {
                ++$written;
            }
        }

        return $written;
    }

    /**
     * Who hears about this, for the types whose audience is derivable.
     *
     * Types not listed carry an explicit recipient list from the call site —
     * a report's reporters, a mention's mentions, a badge's recipient. Returning
     * an empty array for them is correct, not a gap: dispatching one of those
     * without recipients means the call site forgot, and sending it to a guessed
     * audience would be worse than sending it to nobody.
     *
     * @return array<int, int>
     */
    private static function resolveRecipients(
        NotificationTypes $type,
        string $targetType,
        int $targetId,
        ?int $topicId
    ): array {
        $thread = $topicId ?? ($targetType === self::TARGET_TOPIC ? $targetId : 0);

        switch ($type) {
            case NotificationTypes::TOPIC_REPLY:
            case NotificationTypes::TOPIC_STATUS_CHANGED:
                return NotificationRecipients::topicAudience((int) $thread);

            case NotificationTypes::TOPIC_NEW:
                return NotificationRecipients::newTopicAudience((int) $thread);

            case NotificationTypes::COMMENT_REPLY:
                $author = NotificationRecipients::commentAuthor($targetId);

                return $author === null ? [] : [$author];

            case NotificationTypes::VOTE_RECEIVED:
            case NotificationTypes::CONTENT_ACTIONED:
                $author = $targetType === self::TARGET_COMMENT
                    ? NotificationRecipients::commentAuthor($targetId)
                    : NotificationRecipients::topicAuthor($targetId);

                return $author === null ? [] : [$author];

            case NotificationTypes::REPORT_FILED:
                return NotificationRecipients::moderatorIds();

            default:
                return [];
        }
    }

    /**
     * Writes one member's copy, or collapses it into one they already have.
     *
     * @param array<string, mixed> $context
     */
    private static function deliver(
        int $userId,
        int $actorId,
        NotificationTypes $type,
        string $targetType,
        int $targetId,
        array $context,
        ?int $topicId
    ): bool {
        if (!NotificationPreferences::wantsInApp($userId, $type)) {
            return false;
        }

        if (NotificationTypes::isCollapsible($type) && self::collapse($userId, $type, $targetType, $targetId)) {
            self::flushUnreadCount($userId);

            return true;
        }

        // Null means "still owes an email". Stamping the rows nobody wants
        // mailed keeps the digest's index scan to exactly the rows it has work
        // for — see the class note.
        $owesEmail = NotificationPreferences::wantsEmail($userId, $type);

        $stored = Notification::insert(
            [
                'user_id'     => $userId,
                'type'        => $type->value,
                'actor_id'    => $actorId > 0 ? $actorId : null,
                'target_type' => $targetType,
                'target_id'   => $targetId,
                'topic_id'    => $topicId !== null && $topicId > 0 ? $topicId : null,
                'context'     => $context === [] ? null : wp_json_encode($context),
                'event_count' => 1,
                'read_at'     => null,
                'emailed_at'  => $owesEmail ? null : current_time('mysql', true),
            ]
        );

        // insert() answers false rather than throwing. Reporting a write that
        // never happened is how a duplicate-column bug in the reports table
        // survived a green test run.
        if ($stored === false) {
            return false;
        }

        // Read from Connection rather than off the returned model: insert() answers
        // with the Model and whether its id is populated depends on the query
        // builder's save path, while insert_id is set by WordPress on every
        // successful insert. The mailer has no way to find its row without it.

        $notificationId = (int) Connection::prop('insert_id');

        self::flushUnreadCount($userId);

        /*
         * Fired once per delivered notification. The seam instant email hangs
         * off, and where a push or chat channel would attach.
         *
         * @param int    $userId
         * @param string $type
         * @param bool   $owesEmail
         * @param int    $notificationId
         */
        Hooks::doAction('bit_connect_notification_dispatched', $userId, $type->value, $owesEmail, $notificationId);

        return true;
    }

    /**
     * Folds a repeat into the unread row it belongs with.
     *
     * @return bool true when an existing row absorbed this event
     */
    private static function collapse(int $userId, NotificationTypes $type, string $targetType, int $targetId): bool
    {
        $since = gmdate(
            'Y-m-d H:i:s',
            time() - (NotificationSettings::COLLAPSE_WINDOW_MINUTES * MINUTE_IN_SECONDS)
        );

        $existing = Notification::openCollapseTarget($userId, $type->value, $targetType, $targetId, $since);

        if ($existing === null) {
            return false;
        }


        $now = current_time('mysql', true);

        // Incremented in SQL rather than read-then-written: two votes landing
        // together would both read the same count and both store it plus one.
        $updated = Connection::query(
            Connection::prepare(
                'UPDATE ' . Config::withDBPrefix('notifications') . '
                 SET event_count = event_count + 1, updated_at = %s
                 WHERE id = %d AND read_at IS NULL',
                $now,
                (int) $existing->id
            )
        );

        // Zero rows means someone read it between the select and the update, so
        // this event deserves a row of its own after all.
        return $updated !== false && (int) $updated > 0;
    }

    /**
     * Positive unique ids, minus everyone already dealt with.
     *
     * @param array<int, mixed> $candidates
     * @param array<int, int>   $excluded
     *
     * @return array<int, int>
     */
    private static function normalizeIds(array $candidates, array $excluded): array
    {
        $ids = array_map('intval', $candidates);
        $ids = array_filter($ids, static fn (int $id): bool => $id > 0);
        $ids = array_diff(array_unique($ids), $excluded);

        return array_values($ids);
    }

    /**
     * Warms the caches every later get_userdata()/get_post()/get_comment() hits.
     *
     * WordPress answers those from its object cache once the id is in it, so
     * format() below stays readable and simply stops going to the database once
     * per row. The same trick ReportService uses for the queue.
     *
     * @param array<int, mixed> $rows
     */
    private static function primeCaches(array $rows): void
    {
        $actorIds = [];
        $postIds = [];

        foreach ($rows as $row) {
            if ((int) $row->actor_id > 0) {
                $actorIds[] = (int) $row->actor_id;
            }

            if ((int) $row->topic_id > 0) {
                $postIds[] = (int) $row->topic_id;
            }
        }

        if ($actorIds !== []) {
            cache_users(array_values(array_unique($actorIds)));
        }

        if ($postIds !== []) {
            _prime_post_caches(array_values(array_unique($postIds)), false, false);
        }
    }

    /**
     * Shapes one row for the API.
     *
     * Names and titles are resolved at read time and may come back empty, which
     * is why `context` carries a stored copy: the notification that matters most
     * — your content was removed — is precisely the one whose target no longer
     * exists to be read.
     *
     * @param mixed $row
     *
     * @return array<string, mixed>
     */
    private static function format($row): array
    {
        $type = NotificationTypes::tryFrom((string) $row->type);
        $actor = (int) $row->actor_id > 0 ? get_userdata((int) $row->actor_id) : false;
        $context = \is_string($row->context) ? json_decode($row->context, true) : null;

        return [
            'id'   => (int) $row->id,
            'type' => (string) $row->type,
            // phpcs:ignore WordPress.WP.I18n.NonSingularStringLiteralText -- labels are English literals defined in #[Label] attributes; translated here at the read site
            'type_label' => $type ? __($type->label(), 'bit-connect') : (string) $row->type,
            'actor'      => [
                'id'   => (int) $row->actor_id,
                'name' => $actor ? $actor->display_name : '',
                'slug' => (int) $row->actor_id > 0 ? ProfileSlugService::slugFor((int) $row->actor_id) : '',
                // Carried on the row so the list does not need a lookup per
                // actor to draw a face. AvatarService replaces Gravatar
                // globally, so this is the member's uploaded picture wherever
                // they have one.
                'avatar' => $actor ? (string) get_avatar_url((int) $row->actor_id) : '',
                // An empty name means two different things — a deleted account or
                // nobody at all — and the row has to tell them apart. Without
                // this an auto-hide reads as "(deleted account) removed your
                // post", inventing a person where a rule acted.
                'is_system' => (int) $row->actor_id === self::SYSTEM_ACTOR,
            ],
            'target' => [
                'type'   => (string) $row->target_type,
                'id'     => (int) $row->target_id,
                'exists' => self::targetExists((string) $row->target_type, (int) $row->target_id),
            ],
            'topic_id' => (int) $row->topic_id,
            'context'  => \is_array($context) ? $context : [],
            // How many times this collapsed event happened. 1 for everything
            // that is not a vote.
            'count'      => max(1, (int) $row->event_count),
            'read'       => $row->read_at !== null,
            'created_at' => (string) $row->created_at,
        ];
    }

    private static function targetExists(string $targetType, int $targetId): bool
    {
        if ($targetType === self::TARGET_COMMENT) {
            return get_comment($targetId) !== null;
        }

        if ($targetType === self::TARGET_TOPIC) {
            return get_post($targetId) !== null;
        }

        // Reports, badges and members are not posts, and asking get_post() about
        // them would answer false for every one — which the UI would render as
        // "this no longer exists" on a notification about a live thing.
        return true;
    }
}
