<?php

namespace BitApps\BitConnect\Model;

// Prevent direct script access
if (!\defined('ABSPATH')) {
    exit;
}

use BitApps\BitConnect\Config;
use BitApps\BitConnect\Deps\BitApps\WPDatabase\Model;
use BitApps\BitConnect\Deps\BitApps\WPDatabase\Relations;

/**
 * Follow Model.
 *
 * A standing request to hear about something: a thread, a product, a tag.
 *
 * Unfollowing sets `muted` rather than deleting the row — see the migration for
 * why. The consequence to remember when reading this class: **a row's existence
 * does not mean the member wants notifying**. Every recipient query goes through
 * followerIdsFor(), which filters on `muted`; nothing else should read this
 * table to decide who to notify.
 *
 * Writes to existing rows (mute, unmute) go through Connection in FollowService, not
 * through save() — the query builder's update path returns without executing.
 */
class Follow extends Model
{
    use Relations;

    public const TARGET_TOPIC = 'topic';

    public const TARGET_DEPARTMENT = 'department';

    public const TARGET_TAG = 'tag';

    public const TARGET_FORUM = 'forum';

    /**
     * The member pressed Follow.
     */
    public const SOURCE_MANUAL = 'manual';

    /**
     * The member took part, and was subscribed on their behalf.
     */
    public const SOURCE_AUTO = 'auto';

    protected $prefix = Config::VAR_PREFIX;

    protected $fillable = [
        'user_id',
        'target_type',
        'target_id',
        'source',
        'muted',
        // created_at and updated_at are deliberately absent — Model::$timestamps
        // appends them, and naming them here makes MySQL reject the insert.
    ];

    protected $table = 'follows';

    protected $casts = [
        'user_id'   => 'integer',
        'target_id' => 'integer',
        'muted'     => 'integer',
    ];

    /**
     * The ids of everyone following this target and still listening.
     *
     * The one read the dispatcher makes per event. Returns ids rather than rows
     * because that is all a recipient list is, and loading follow rows to throw
     * away every column but one would make a hot path cost more than it earns.
     *
     * @return array<int, int>
     */
    public static function followerIdsFor(string $targetType, int $targetId): array
    {
        $rows = static::select(['user_id'])
            ->where('target_type', $targetType)
            ->where('target_id', $targetId)
            ->where('muted', 0)
            ->get();

        return array_values(
            array_unique(
                array_map(static fn ($row): int => (int) $row->user_id, self::asList($rows))
            )
        );
    }

    /**
     * Whatever get() answered, as a list of rows.
     *
     * A limit-1 result that matched exactly one row comes back as a bare Model
     * rather than a list — see the note on findFor(). The plain array cast this
     * replaces would have turned that one Model into its own property list
     * without saying so.
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

    /**
     * One member's follow of one thing, muted or not.
     *
     * Returns muted rows too, on purpose: the caller asking "is this followed?"
     * needs to tell "never followed" from "followed and silenced", because those
     * are different buttons.
     *
     * Not named find(): QueryBuilder::find($attributes) already exists and
     * reaches models through __callStatic, so a same-named static here would
     * shadow it with an incompatible signature for every caller.
     *
     * @return null|object one row, with its columns as properties
     */
    public static function findFor(int $userId, string $targetType, int $targetId)
    {
        $found = static::select(['*'])
            ->where('user_id', $userId)
            ->where('target_type', $targetType)
            ->where('target_id', $targetId)
            ->take('1')
            ->get();

        // get() hands back a single Model rather than a list when the limit is 1
        // and exactly one row matched — see Model::getInstanceFromBuilder(). It
        // answers [] for no match and false when the query itself failed. Casting
        // the Model case to an array yields the model's own properties ($table,
        // $casts, $fillable…) and not the row, so every column read off it comes
        // back empty: a muted follow read as unmuted and the button said Unfollow
        // on a thread the member had already silenced.
        return $found instanceof Model ? $found : null;
    }

    /**
     * Everything one member follows and has not muted, newest first.
     *
     * @return array{data: array<int, object>, total: int, pages: int}
     */
    public static function activeFor(int $userId, string $targetType, int $page, int $perPage)
    {
        $result = static::select(['*'])
            ->where('user_id', $userId)
            ->where('target_type', $targetType)
            ->where('muted', 0)
            ->orderBy('created_at')
            ->desc()
            ->paginate($page, $perPage);

        // A per-page of 1 comes back as a bare Model, not a list — paginate()
        // forwards it to take(). See asList().
        $result['data'] = self::asList($result['data'] ?? []);

        return $result;
    }
}
