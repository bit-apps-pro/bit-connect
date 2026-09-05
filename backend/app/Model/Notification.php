<?php

namespace BitApps\BitConnect\Model;

// Prevent direct script access
if (!\defined('ABSPATH')) {
    exit;
}

use BitApps\BitConnect\Config;
use BitApps\BitConnect\Deps\BitApps\WPDatabase\Connection;
use BitApps\BitConnect\Deps\BitApps\WPDatabase\Model;
use BitApps\BitConnect\Deps\BitApps\WPDatabase\Relations;

/**
 * Notification Model.
 *
 * One row per recipient per event. The fan-out is on write so the read — the
 * bell, on every page load, for every logged-in member — is a single indexed
 * count.
 *
 * Rows outlive their targets on purpose. "Your comment was removed" is the one
 * notification that matters most and the one a foreign key would delete at the
 * moment it came true, so `target_id` is a plain number that may resolve to
 * nothing and `context` carries a stored title and excerpt to read in its place.
 *
 * Reads go through this class; **writes that touch an existing row do not**.
 * QueryBuilder::update() builds a statement and returns $this without executing
 * (exec() is private), and save() on a fetched row emits a mismatched column
 * list — both fail quietly enough that nothing looks broken until the feature
 * simply never works. Marking read, bumping the collapse counter and stamping
 * emailed_at all go through Connection::update() in NotificationService.
 */
class Notification extends Model
{
    use Relations;

    protected $prefix = Config::VAR_PREFIX;

    protected $fillable = [
        'user_id',
        'type',
        'actor_id',
        'target_type',
        'target_id',
        'topic_id',
        'context',
        'event_count',
        'read_at',
        'emailed_at',
        // created_at and updated_at are deliberately absent: Model::$timestamps
        // is true, so the query builder appends both on every insert. Listing
        // them here as well made the builder emit each column twice and MySQL
        // rejected the statement outright.
    ];

    protected $table = 'notifications';

    protected $casts = [
        'user_id'     => 'integer',
        'actor_id'    => 'integer',
        'target_id'   => 'integer',
        'topic_id'    => 'integer',
        'event_count' => 'integer',
    ];

    /**
     * Relationship: the member who caused this.
     *
     * Null on the row for anything the forum did by rule rather than by
     * decision — an auto-hide crossing the report threshold has no actor, and
     * naming one would invent a person where a rule acted.
     */
    public function actor()
    {
        return $this->belongsTo(User::class, 'actor_id', 'ID');
    }

    /**
     * One member's notifications, newest first.
     *
     * @return array{data: array<int, object>, total: int, pages: int}
     */
    public static function feedFor(int $userId, int $page, int $perPage, bool $unreadOnly = false)
    {
        $query = static::select(['*'])->where('user_id', $userId);

        if ($unreadOnly) {
            // whereNull(), not where('read_at', null): the builder renders the
            // second form as `= NULL`, which matches nothing in SQL — the unread
            // tab would have come back permanently empty.
            $query = $query->whereNull('read_at');
        }

        $result = $query->orderBy('created_at')->desc()->paginate($page, $perPage);

        // A per-page of 1 comes back as a bare Model rather than a list —
        // paginate() forwards it to take(). See asList().
        $result['data'] = self::asList($result['data'] ?? []);

        return $result;
    }

    /**
     * The unread row a repeat of this event should fold into, if there is one.
     *
     * Two conditions, and both matter. Unread, because once a member has seen
     * "3 people upvoted this" a fourth vote is news again and editing a row they
     * have already read would change history behind them. Recent, because
     * without a window the same row would keep absorbing votes for as long as it
     * went unread, and "12 people upvoted this" would be about a month rather
     * than about a burst.
     *
     * @param string $since UTC 'Y-m-d H:i:s'; rows older than this are left alone
     *
     * @return null|object one row, with its columns as properties
     */
    public static function openCollapseTarget(
        int $userId,
        string $type,
        string $targetType,
        int $targetId,
        string $since
    ) {
        $found = static::select(['*'])
            ->where('user_id', $userId)
            ->where('type', $type)
            ->where('target_type', $targetType)
            ->where('target_id', $targetId)
            ->where('created_at', '>=', $since)
            ->whereNull('read_at')
            ->orderBy('created_at')
            ->desc()
            // Cast because QueryBuilder::take() is typed for a string.
            ->take('1')
            ->get();

        // get() hands back a single Model rather than a list when the limit is 1
        // and exactly one row matched — see Model::getInstanceFromBuilder(). It
        // answers [] for no match and false when the query itself failed.
        // Casting the Model case to an array yields the model's own properties
        // ($table, $casts, $fillable…) instead of the row, so `$existing->id`
        // would read as empty and every vote would write a new row while
        // reporting that it had collapsed. Follow::findFor() carries the same
        // guard for the same reason.
        return $found instanceof Model ? $found : null;
    }

    /**
     * Of these ids, the ones belonging to this member that still owe an email.
     *
     * Re-read at send time rather than trusted from dispatch: between the two
     * the member may have read the notification in another tab, or a digest may
     * have claimed the row. `emailed_at IS NULL` in the WHERE is what makes the
     * two senders safe to run at once.
     *
     * `user_id` is in the clause as well as the ids, so a bug that mixed ids
     * between members cannot mail one person another's notifications.
     *
     * @param array<int, int> $ids
     *
     * @return array<int, object>
     */
    public static function owingEmail(int $userId, array $ids): array
    {
        $ids = array_values(array_filter(array_map('intval', $ids), static fn (int $id): bool => $id > 0));

        if ($userId <= 0 || $ids === []) {
            return [];
        }


        // Written through Connection rather than the query builder: this needs an IN
        // clause, an IS NULL and a sort together, and the builder's whereIn()
        // does not compose with whereNull() cleanly enough to be worth the
        // indirection for a read this shape.
        $table = Config::withDBPrefix('notifications');
        $placeholders = implode(',', array_fill(0, \count($ids), '%d'));

        return (array) Connection::get_results(
            Connection::prepare(
                "SELECT * FROM {$table}
                 WHERE user_id = %d AND emailed_at IS NULL AND id IN ({$placeholders})
                 ORDER BY id",
                $userId,
                ...$ids
            )
        );
    }

    /**
     * Members with mail waiting, oldest waiting first.
     *
     * The digest's outer loop. Capped because a forum that has had mail broken
     * for a week should send what it can and come back for the rest next hour,
     * rather than time the cron out and send nothing at all — forever.
     *
     * @return array<int, int>
     */
    public static function userIdsOwingEmail(int $limit = 200): array
    {
        $table = Config::withDBPrefix('notifications');

        $ids = Connection::get_col(
            Connection::prepare(
                "SELECT user_id FROM {$table}
                 WHERE emailed_at IS NULL
                 GROUP BY user_id
                 ORDER BY MIN(created_at)
                 LIMIT %d",
                max(1, $limit)
            )
        );

        return array_map('intval', (array) $ids);
    }

    /**
     * One member's unsent notifications, oldest first.
     *
     * @return array<int, object>
     */
    public static function owingEmailForUser(int $userId, int $limit = 50): array
    {
        if ($userId <= 0) {
            return [];
        }


        $table = Config::withDBPrefix('notifications');

        return (array) Connection::get_results(
            Connection::prepare(
                "SELECT * FROM {$table}
                 WHERE user_id = %d AND emailed_at IS NULL
                 ORDER BY created_at
                 LIMIT %d",
                $userId,
                max(1, $limit)
            )
        );
    }

    /**
     * Whatever get() or paginate() answered, as a list of rows.
     *
     * Kept here rather than shared with Follow: each model is self-contained in
     * this codebase, and the six lines cost less than a base class that exists
     * to hold them.
     *
     * @param mixed $result
     *
     * @return array<int, object>
     */
    public static function asList($result): array
    {
        if ($result instanceof Model) {
            return [$result];
        }

        return \is_array($result) ? array_values($result) : [];
    }
}
