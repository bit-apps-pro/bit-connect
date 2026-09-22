<?php

namespace BitApps\BitConnect\Model;

// Prevent direct script access
if (!defined('ABSPATH')) {
    exit;
}

use BitApps\BitConnect\Config;
use BitApps\BitConnect\Deps\BitApps\WPDatabase\Model;

/**
 * Vote Model.
 *
 * An upvote on a topic. One record per (user_id, post_id), enforced by a unique
 * DB index; casting an upvote inserts the row and retracting it deletes the row.
 *
 * Upvoting an individual reply is not this plugin's feature, so there is no
 * comment column here, nothing that writes one, and nothing that reads one.
 *
 * Cached totals (_bit_connect_vote_count, see VoteService::META_VOTE_COUNT) are
 * stored in wp_postmeta by VoteService and are authoritative for reads. This
 * table is the source of truth for a member's vote history.
 */
class Vote extends Model
{
    protected $prefix = Config::VAR_PREFIX;

    protected $fillable = [
        'user_id',
        'post_id',
    ];

    protected $table = 'votes';

    protected $casts = [
        'user_id' => 'integer',
        'post_id' => 'integer',
    ];

    /**
     * Relationship: Vote belongs to a User.
     */
    public function user()
    {
        return $this->belongsTo(User::class, 'user_id', 'ID');
    }

    /**
     * Relationship: Vote belongs to a Post.
     */
    public function post()
    {
        return $this->belongsTo(Post::class, 'post_id', 'ID');
    }

    // -------------------------------------------------------------------------
    // Post vote queries
    // -------------------------------------------------------------------------

    public static function getPostVoteCount(int $postId): int
    {
        return static::where('post_id', $postId)->count() ?? 0;
    }

    public static function hasUserVoted(int $userId, int $postId): bool
    {
        return static::where('user_id', $userId)
            ->where('post_id', $postId)
            ->count() > 0;
    }

    public static function getUserVoteForPost(int $userId, int $postId)
    {
        return static::where('user_id', $userId)
            ->where('post_id', $postId)
            ->first();
    }

    public static function getPostVotes(int $postId)
    {
        return static::where('post_id', $postId)->get();
    }

    public static function deleteUserVoteForPost(int $userId, int $postId): bool
    {
        return static::where('user_id', $userId)
            ->where('post_id', $postId)
            ->delete() > 0;
    }

    public static function deleteAllVotesForPost(int $postId): bool
    {
        return !empty(static::where('post_id', $postId)->delete());
    }

    // -------------------------------------------------------------------------
    // User vote history
    // -------------------------------------------------------------------------

    public static function getUserVotes(int $userId)
    {
        return static::where('user_id', $userId)->get();
    }

    public static function deleteAllVotesByUser(int $userId): bool
    {
        return !empty(static::where('user_id', $userId)->delete());
    }
}
