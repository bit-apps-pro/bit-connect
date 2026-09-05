<?php

namespace BitApps\BitConnect\Services;

// Prevent direct script access
if (!\defined('ABSPATH')) {
    exit;
}

use BitApps\BitConnect\Config;
use BitApps\BitConnect\Deps\BitApps\WPDatabase\Connection;
use BitApps\BitConnect\Deps\BitApps\WPKit\Hooks\Hooks;
use BitApps\BitConnect\Enum\PostTypes;
use WP_Comment;
use WP_Post;

/**
 * Public contribution totals for a portal member.
 *
 * Everything here aggregates content the visitor can already see, so the
 * figures are safe to expose without authentication. Nothing account-related
 * (email, role, login) is read.
 *
 * Counts are computed live rather than kept in user meta, then cached: the
 * author's card is rendered on every topic they wrote, and two of the four
 * queries scan wp_comments in full because core indexes no user_id there, so
 * the cost tracks the whole site's comment table rather than the member's own
 * activity.
 *
 * The cached copy is dropped the moment the numbers underneath it move —
 * registerHooks() below for topics and comments, VoteService for votes — so the
 * TTL is only a backstop for whatever slips past those, not the normal way a
 * total becomes current.
 */
class UserStatsService
{
    /**
     * Seconds to keep a computed set of totals.
     *
     * A backstop only — see the class docblock. Anything that moves a total
     * drops the entry outright, so this bounds how long a total can be wrong
     * after an event nothing hooked, not how long a vote takes to show up.
     */
    private const CACHE_TTL = 5 * MINUTE_IN_SECONDS;

    /**
     * Drop cached totals as the content behind them changes.
     *
     * WordPress announces every event that moves the topic and comment counts,
     * which also covers the ones the portal's own API never sees — an editor
     * trashing a topic in wp-admin, a moderator approving a comment.
     *
     * Votes have no core hook; VoteService drops the author's copy directly.
     */
    public static function registerHooks(): void
    {
        // Publishing, unpublishing, trashing and restoring all arrive as a
        // status transition, so one hook covers every move of the topic count.
        Hooks::addAction('transition_post_status', [self::class, 'handlePostStatusChanged'], 10, 3);
        Hooks::addAction('deleted_post', [self::class, 'handlePostDeleted'], 10, 2);

        // A comment inserted already approved never transitions, so the insert
        // is needed alongside the transition to catch every approved comment.
        Hooks::addAction('wp_insert_comment', [self::class, 'handleCommentChanged'], 10, 2);
        Hooks::addAction('transition_comment_status', [self::class, 'handleCommentStatusChanged'], 10, 3);
        Hooks::addAction('deleted_comment', [self::class, 'handleCommentChanged'], 10, 2);
    }

    /**
     * Totals for a member, or null when the user does not exist.
     *
     * @param int $userId
     *
     * @return null|array{topics:int, comments:int, votes_received:int, registered_at:string}
     */
    public function forUser($userId)
    {
        $userId = (int) $userId;
        $user = get_userdata($userId);

        if (!$user) {
            return;
        }

        $cacheKey = Config::VAR_PREFIX . 'user_stats_' . $userId;
        $cached = get_transient($cacheKey);

        if (\is_array($cached)) {
            return $cached;
        }

        $stats = [
            'topics'         => $this->countTopics($userId),
            'comments'       => $this->countComments($userId),
            'votes_received' => $this->countVotesReceived($userId),
            'registered_at'  => $user->user_registered,
        ];

        set_transient($cacheKey, $stats, self::CACHE_TTL);

        return $stats;
    }

    /**
     * Drop the cached totals for a user, e.g. after they post or receive a vote.
     *
     * @param int|string $userId WP_Post::$post_author and WP_Comment::$user_id
     *                           are both numeric strings, so both are accepted
     */
    public static function forget($userId): void
    {
        delete_transient(Config::VAR_PREFIX . 'user_stats_' . (int) $userId);
    }

    /**
     * Action callback: a topic was published, unpublished, trashed or restored.
     *
     * Fires on every save, including ones that leave the status alone, so an
     * unchanged status is ignored rather than pointlessly dropping the entry.
     *
     * @param string $newStatus
     * @param string $oldStatus
     * @param mixed  $post
     */
    public static function handlePostStatusChanged($newStatus, $oldStatus, $post): void
    {
        if ($newStatus === $oldStatus || !$post instanceof WP_Post) {
            return;
        }

        if ($post->post_type !== PostTypes::BIT_CONNECT->value) {
            return;
        }

        self::forget($post->post_author);
    }

    /**
     * Action callback: a topic was deleted for good, taking its votes with it.
     *
     * @param int   $postId
     * @param mixed $post    only passed since WP 5.5; the row is already gone
     */
    public static function handlePostDeleted($postId, $post = null): void
    {
        $post = $post instanceof WP_Post ? $post : get_post((int) $postId);

        if (!$post instanceof WP_Post || $post->post_type !== PostTypes::BIT_CONNECT->value) {
            return;
        }

        self::forget($post->post_author);
    }

    /**
     * Action callback for hooks passing the comment second — insert and delete.
     *
     * @param int   $commentId
     * @param mixed $comment
     */
    public static function handleCommentChanged($commentId, $comment = null): void
    {
        self::forgetCommentAuthor(
            $comment instanceof WP_Comment ? $comment : get_comment((int) $commentId)
        );
    }

    /**
     * Action callback: a comment was approved, unapproved, spammed or trashed.
     *
     * @param string $newStatus
     * @param string $oldStatus
     * @param mixed  $comment
     */
    public static function handleCommentStatusChanged($newStatus, $oldStatus, $comment): void
    {
        if ($newStatus === $oldStatus) {
            return;
        }

        self::forgetCommentAuthor($comment);
    }

    /**
     * Drop the totals of whoever wrote a comment the portal counts.
     *
     * Guests are skipped — they have no profile and so no totals — as are
     * comments on anything outside the portal, which countComments() excludes.
     *
     * @param mixed $comment
     */
    private static function forgetCommentAuthor($comment): void
    {
        if (!$comment instanceof WP_Comment) {
            return;
        }

        $userId = (int) $comment->user_id;

        if ($userId <= 0) {
            return;
        }

        $post = get_post((int) $comment->comment_post_ID);

        if (!$post instanceof WP_Post || $post->post_type !== PostTypes::BIT_CONNECT->value) {
            return;
        }

        self::forget($userId);
    }

    /**
     * Published topics authored by the user.
     *
     * @param int $userId
     *
     * @return int
     */
    private function countTopics($userId)
    {
        $wpdbPosts = Connection::prop('posts');

        return (int) Connection::get_var(
            Connection::prepare(
                "SELECT COUNT(*) FROM {$wpdbPosts}
                 WHERE post_author = %d AND post_type = %s AND post_status = 'publish'",
                $userId,
                PostTypes::BIT_CONNECT->value
            )
        );
    }

    /**
     * Approved comments the user left on portal topics.
     *
     * @param int $userId
     *
     * @return int
     */
    private function countComments($userId)
    {
        $wpdbComments = Connection::prop('comments');
        $wpdbPosts = Connection::prop('posts');

        return (int) Connection::get_var(
            Connection::prepare(
                "SELECT COUNT(*) FROM {$wpdbComments} c
                 INNER JOIN {$wpdbPosts} p ON p.ID = c.comment_post_ID
                 WHERE c.user_id = %d AND c.comment_approved = '1' AND p.post_type = %s",
                $userId,
                PostTypes::BIT_CONNECT->value
            )
        );
    }

    /**
     * Votes other members cast on this user's topics and comments.
     *
     * @param int $userId
     *
     * @return int
     */
    private function countVotesReceived($userId)
    {
        $wpdbComments = Connection::prop('comments');
        $wpdbPosts = Connection::prop('posts');
        $wpdbPrefix = Connection::prop('prefix');

        $votes = $wpdbPrefix . Config::VAR_PREFIX . 'votes';

        $onTopics = (int) Connection::get_var(
            Connection::prepare(
                "SELECT COUNT(*) FROM {$votes} v
                 INNER JOIN {$wpdbPosts} p ON p.ID = v.post_id
                 WHERE p.post_author = %d AND p.post_type = %s",
                $userId,
                PostTypes::BIT_CONNECT->value
            )
        );

        $onComments = (int) Connection::get_var(
            Connection::prepare(
                "SELECT COUNT(*) FROM {$votes} v
                 INNER JOIN {$wpdbComments} c ON c.comment_ID = v.comment_id
                 WHERE c.user_id = %d",
                $userId
            )
        );

        return $onTopics + $onComments;
    }
}
