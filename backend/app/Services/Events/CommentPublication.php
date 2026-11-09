<?php

namespace BitApps\BitConnect\Services\Events;

// Prevent direct script access
if (!defined('ABSPATH')) {
    exit;
}

use BitApps\BitConnect\Deps\BitApps\WPKit\Hooks\Hooks;
use BitApps\BitConnect\Enum\PostTypes;
use WP_Comment;
use WP_Post;

/**
 * Fires `comment_created` when a comment is public, as TopicPublication does
 * for posts.
 *
 * With the site's "Comment must be manually approved" setting on, a new
 * comment is held. A held comment must not reach a Slack channel or a
 * newsletter, so its event waits: created() marks it, and the approval fires
 * the event once and removes the mark.
 *
 * Only a comment this plugin held carries the mark. A comment hidden after a
 * report goes to "hold" too, and its restore is not a new comment.
 */
final class CommentPublication
{
    public const AWAITING_META = '_bit_connect_announce_on_approve';

    public static function register(): void
    {
        Hooks::addAction('transition_comment_status', [self::class, 'onTransition'], 20, 3);
    }

    /**
     * Called by CommentService once the comment is written.
     */
    public static function created(WP_Comment $comment, WP_Post $post): void
    {
        if (self::isPublic($comment)) {
            Events::commentCreated($comment, $post);

            return;
        }

        update_comment_meta((int) $comment->comment_ID, self::AWAITING_META, 1);
    }

    /**
     * Whether listeners have heard of this comment: it is public and not
     * waiting for its first approval.
     */
    public static function isAnnounced(WP_Comment $comment): bool
    {
        return self::isPublic($comment) && !get_comment_meta((int) $comment->comment_ID, self::AWAITING_META, true);
    }

    /**
     * @param string     $new
     * @param string     $old
     * @param WP_Comment $comment
     */
    public static function onTransition($new, $old, $comment): void // phpcs:ignore VariableAnalysis.CodeAnalysis.VariableAnalysis.UnusedVariable
    {
        if ($new !== 'approved' || !$comment instanceof WP_Comment) {
            return;
        }

        $id = (int) $comment->comment_ID;

        if (!get_comment_meta($id, self::AWAITING_META, true)) {
            return;
        }

        delete_comment_meta($id, self::AWAITING_META);

        $post = get_post((int) $comment->comment_post_ID);
        $fresh = get_comment($id);

        if ($post instanceof WP_Post && $post->post_type === PostTypes::BIT_CONNECT->value && $fresh instanceof WP_Comment) {
            Events::commentCreated($fresh, $post);
        }
    }

    private static function isPublic(WP_Comment $comment): bool
    {
        return (string) $comment->comment_approved === '1';
    }
}
