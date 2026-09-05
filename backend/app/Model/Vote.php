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
 * Vote Model.
 *
 * Represents a directional vote (upvote or downvote) on a forum post or comment.
 *
 * vote_type values:
 *   1  = upvote
 *  -1  = downvote
 *
 * One record per (user_id, post_id) and one per (user_id, comment_id), enforced
 * by unique DB indexes.  To change vote direction, the existing row is updated.
 * To remove a vote, the row is deleted.
 *
 * Cached totals (_bc_upvote_count, _bc_downvote_count) are stored in
 * wp_postmeta / wp_commentmeta by VoteService and are authoritative for reads.
 * This table is the source of truth for user vote history and direction.
 */
class Vote extends Model
{
    use Relations;

    protected $prefix = Config::VAR_PREFIX;

    protected $fillable = [
        'user_id',
        'post_id',
        'comment_id',
    ];

    protected $table = 'votes';

    protected $casts = [
        'user_id'    => 'integer',
        'post_id'    => 'integer',
        'comment_id' => 'integer',
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
    // Comment vote queries
    // -------------------------------------------------------------------------

    public static function getCommentVoteCount(int $commentId): int
    {
        return static::where('comment_id', $commentId)->count() ?? 0;
    }

    public static function hasUserVotedComment(int $userId, int $commentId): bool
    {
        return static::where('user_id', $userId)
            ->where('comment_id', $commentId)
            ->count() > 0;
    }

    public static function getUserVoteForComment(int $userId, int $commentId)
    {
        return static::where('user_id', $userId)
            ->where('comment_id', $commentId)
            ->first();
    }

    public static function deleteUserVoteForComment(int $userId, int $commentId): bool
    {
        return static::where('user_id', $userId)
            ->where('comment_id', $commentId)
            ->delete() > 0;
    }

    public static function deleteAllVotesForComment(int $commentId): bool
    {
        return !empty(static::where('comment_id', $commentId)->delete());
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
