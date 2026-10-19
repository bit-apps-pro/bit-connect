<?php

namespace BitApps\BitConnect\Services;

// Prevent direct script access
if (!defined('ABSPATH')) {
    exit;
}

use BitApps\BitConnect\Deps\BitApps\WPKit\Hooks\Hooks;
use BitApps\BitConnect\Enum\PostTypes;
use WP_Comment;
use WP_Post;

/**
 * The admin dashboard's computed answer, kept for a few minutes per period.
 *
 * The dashboard runs about twenty aggregate queries over every topic, comment
 * and vote. On a small host that is the slowest request in the admin, and an
 * admin who opens it, switches period and comes back asks for the same numbers
 * three times. One entry holds every period, so one delete drops them all.
 *
 * Topics, comments and reports drop the entry as they change — the counts an
 * admin acts on stay current. Votes do not: on a busy forum they arrive faster
 * than the cache would ever be read, and a vote total a few minutes old misleads
 * nobody. The TTL bounds that.
 */
final class DashboardCache
{
    private const KEY = 'bit_connect_dashboard';

    private const TTL = 5 * MINUTE_IN_SECONDS;

    public static function registerHooks(): void
    {
        Hooks::addAction('transition_post_status', [self::class, 'handlePostStatusChanged'], 10, 3);
        Hooks::addAction('deleted_post', [self::class, 'handlePostDeleted'], 10, 2);

        // An approved insert never transitions, so both hooks are needed.
        Hooks::addAction('wp_insert_comment', [self::class, 'handleCommentChanged'], 10, 2);
        Hooks::addAction('transition_comment_status', [self::class, 'handleCommentStatusChanged'], 10, 3);
        Hooks::addAction('deleted_comment', [self::class, 'handleCommentChanged'], 10, 2);

        // The Members card counts every account, not only forum members.
        Hooks::addAction('user_register', [self::class, 'forget']);
        Hooks::addAction('deleted_user', [self::class, 'forget']);
    }

    /**
     * The cached answer for a period, or null when there is none.
     */
    public static function get(string $period): ?array
    {
        $entry = get_transient(self::KEY);

        return \is_array($entry) && \is_array($entry[$period] ?? null) ? $entry[$period] : null;
    }

    public static function put(string $period, array $data): void
    {
        $entry = get_transient(self::KEY);
        $entry = \is_array($entry) ? $entry : [];
        $entry[$period] = $data;

        set_transient(self::KEY, $entry, self::TTL);
    }

    public static function forget(): void
    {
        delete_transient(self::KEY);
    }

    /**
     * @param string $newStatus
     * @param string $oldStatus
     * @param mixed  $post
     */
    public static function handlePostStatusChanged($newStatus, $oldStatus, $post): void
    {
        if ($newStatus !== $oldStatus && self::isTopic($post)) {
            self::forget();
        }
    }

    /**
     * @param int|string $postId
     * @param mixed      $post
     */
    public static function handlePostDeleted($postId, $post = null): void
    {
        if (self::isTopic($post instanceof WP_Post ? $post : get_post((int) $postId))) {
            self::forget();
        }
    }

    /**
     * @param int|string $commentId
     * @param mixed      $comment
     */
    public static function handleCommentChanged($commentId, $comment = null): void
    {
        $comment = $comment instanceof WP_Comment ? $comment : get_comment((int) $commentId);

        if ($comment instanceof WP_Comment && self::isTopic(get_post((int) $comment->comment_post_ID))) {
            self::forget();
        }
    }

    /**
     * @param string $newStatus
     * @param string $oldStatus
     * @param mixed  $comment
     */
    public static function handleCommentStatusChanged($newStatus, $oldStatus, $comment): void
    {
        if ($newStatus !== $oldStatus && $comment instanceof WP_Comment) {
            self::handleCommentChanged((int) $comment->comment_ID, $comment);
        }
    }

    /**
     * @param mixed $post
     */
    private static function isTopic($post): bool
    {
        return $post instanceof WP_Post && $post->post_type === PostTypes::BIT_CONNECT->value;
    }
}
