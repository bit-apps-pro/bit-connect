<?php

namespace BitApps\BitConnect\Model;

// Prevent direct script access
if (!defined('ABSPATH')) {
    exit;
}

use BitApps\BitConnect\Config;
use BitApps\BitConnect\Deps\BitApps\WPDatabase\Model;
use BitApps\BitConnect\Deps\BitApps\WPDatabase\Relations;

/**
 * ActivityLog Model.
 *
 * One row per action taken on content the actor did not write.
 *
 * Rows are append-only and outlive their targets. Nothing here is a foreign key
 * to wp_posts or wp_comments: the row being described may already be deleted —
 * that is frequently the point — so `target_id` is a plain number that may
 * resolve to nothing, and `target_author` is stored rather than looked up.
 */
class ActivityLog extends Model
{
    use Relations;

    protected $prefix = Config::VAR_PREFIX;

    protected $fillable = [
        'actor_id',
        'action',
        'target_type',
        'target_id',
        'target_author',
        'reason',
        'context',
        // created_at and updated_at are deliberately absent: Model::$timestamps
        // is true, so the query builder appends both on every insert. Listing
        // them here as well made the builder emit each column twice and MySQL
        // rejected the statement outright.
    ];

    protected $table = 'activity_log';

    protected $casts = [
        'actor_id'      => 'integer',
        'target_id'     => 'integer',
        'target_author' => 'integer',
    ];

    /**
     * Relationship: the member who took the action.
     *
     * Only meaningful while their account exists — a deleted actor leaves the
     * id behind on the row, which is what keeps the history honest.
     */
    public function actor()
    {
        return $this->belongsTo(User::class, 'actor_id', 'ID');
    }

    /**
     * Everything recorded against one topic or comment, newest first.
     */
    public static function forTarget(string $targetType, int $targetId)
    {
        return static::where('target_type', $targetType)
            ->where('target_id', $targetId)
            ->orderBy('created_at')
            ->desc()
            ->get();
    }

    /**
     * Everything one member has done, newest first.
     */
    public static function byActor(int $actorId, int $limit = 50)
    {
        return static::where('actor_id', $actorId)
            ->orderBy('created_at')
            ->desc()
            // Cast because QueryBuilder::take() is typed for a string.
            ->take((string) $limit)
            ->get();
    }
}
