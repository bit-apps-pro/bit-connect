<?php

namespace BitApps\BitConnect\Services;

// Prevent direct script access
if (!defined('ABSPATH')) {
    exit;
}

use WP_Comment;
use WP_Post;

/**
 * Taking reported content out of public view, and putting it back.
 *
 * Topics use a post status of their own rather than a meta flag. Every query in
 * this plugin names the statuses it wants — TopicService asks for publish and
 * private — so a status they do not name is excluded from all of them at once,
 * with no query to hunt down and patch and no way for a direct URL to serve
 * what a listing hides. A meta flag would have needed both.
 *
 * Comments use WordPress's own held state, which core already excludes from
 * public listings.
 *
 * Either way the previous state is stored before it changes, so restoring puts
 * the content back exactly where it was: a private topic returns private, not
 * published to everyone by a moderator clicking Keep.
 */
final class ContentVisibilityService
{
    /**
     * Post status for a hidden topic.
     *
     * Registered as non-public, so WP_Query excludes it unless asked by name.
     */
    public const HIDDEN_STATUS = 'bc_hidden';

    /**
     * Where the pre-hide state is kept, on the post or the comment.
     *
     * Its presence is also what separates a comment held because it was
     * reported from one held because the site moderates every new comment —
     * the second kind must not be given a "removed by a moderator" tombstone.
     */
    public const PREV_STATUS_META = '_bc_hidden_prev_status';

    /**
     * Registers the hidden post status. Called from PostTypeProvider.
     */
    public static function registerPostStatus(): void
    {
        register_post_status(
            self::HIDDEN_STATUS,
            [
                'label'                     => __('Hidden pending review', 'bit-connect'),
                'public'                    => false,
                'internal'                  => false,
                'exclude_from_search'       => true,
                'show_in_admin_all_list'    => false,
                'show_in_admin_status_list' => true,
                // translators: %s: number of hidden topics
                'label_count' => _n_noop(
                    'Hidden pending review <span class="count">(%s)</span>',
                    'Hidden pending review <span class="count">(%s)</span>',
                    'bit-connect'
                ),
            ]
        );
    }

    /**
     * Whether the current user may see content that is hidden from the public.
     *
     * Moderators only. Authors get their own content back through
     * isVisibleToAuthor() instead, which is deliberately not folded in here:
     * this answer is also what decides whether a *comment* is replaced by a
     * tombstone for the reader, and every reader would then see their own
     * neighbours' hidden replies if it meant "or you wrote it".
     */
    public static function canViewHidden(): bool
    {
        return PermissionService::canModerate();
    }

    /**
     * Whether this hidden thing belongs to whoever is asking.
     *
     * An author who is not told anything watches their topic vanish from the
     * portal, from their own profile and from its own URL, with a 404 where
     * their words were. Being able to see it — marked, and still out of every
     * public listing — is the difference between moderation and losing work.
     */
    public static function isOwnContent(int $authorId): bool
    {
        $viewer = get_current_user_id();

        return $viewer > 0 && $viewer === $authorId;
    }

    /**
     * Whether a hidden post should still be served to the person asking.
     */
    public static function isPostViewableWhileHidden(int $authorId): bool
    {
        return self::canViewHidden() || self::isOwnContent($authorId);
    }

    // -------------------------------------------------------------------------
    // Topics
    // -------------------------------------------------------------------------

    public static function isPostHidden(int $postId): bool
    {
        $post = get_post($postId);

        return $post instanceof WP_Post && $post->post_status === self::HIDDEN_STATUS;
    }

    /**
     * Takes a topic out of public view, remembering where it was.
     *
     * @return bool false when it was already hidden or does not exist
     */
    public static function hidePost(int $postId): bool
    {
        $post = get_post($postId);

        if (!$post instanceof WP_Post || $post->post_status === self::HIDDEN_STATUS) {
            return false;
        }

        update_post_meta($postId, self::PREV_STATUS_META, $post->post_status);

        $result = wp_update_post(['ID' => $postId, 'post_status' => self::HIDDEN_STATUS]);

        if (is_wp_error($result)) {
            // Leaving the meta behind would make a later restore claim a hide
            // that never happened.
            delete_post_meta($postId, self::PREV_STATUS_META);

            return false;
        }

        return true;
    }

    /**
     * Puts a topic back where it was before it was hidden.
     *
     * @return bool false when it was not hidden
     */
    public static function restorePost(int $postId): bool
    {
        if (!self::isPostHidden($postId)) {
            return false;
        }

        $previous = (string) get_post_meta($postId, self::PREV_STATUS_META, true);

        // A topic hidden by an older build, or one whose meta was lost, still
        // has to come back to something. Publish is the safe reading: it is
        // what all but a handful of topics were.
        if ($previous === '' || $previous === self::HIDDEN_STATUS) {
            $previous = 'publish';
        }

        $result = wp_update_post(['ID' => $postId, 'post_status' => $previous]);

        if (is_wp_error($result)) {
            return false;
        }

        delete_post_meta($postId, self::PREV_STATUS_META);

        return true;
    }

    // -------------------------------------------------------------------------
    // Comments
    // -------------------------------------------------------------------------

    /**
     * Whether this comment is held *because it was reported*.
     *
     * Not the same as being unapproved: a site with comment moderation on holds
     * every new comment, and those are waiting for a first look rather than
     * having been taken down.
     *
     * @param int|WP_Comment $comment id, or the row when the caller already has
     *                                it — a hundred-comment thread should not
     *                                re-fetch every row to ask this
     */
    public static function isCommentHidden($comment): bool
    {
        $comment = $comment instanceof WP_Comment ? $comment : get_comment((int) $comment);

        if (!$comment instanceof WP_Comment) {
            return false;
        }

        return (string) $comment->comment_approved !== '1'
            && get_comment_meta((int) $comment->comment_ID, self::PREV_STATUS_META, true) !== '';
    }

    /**
     * Narrows a comment list to what a thread should render.
     *
     * Approved comments, plus the ones held because they were reported. Those
     * are kept rather than dropped so the thread keeps its shape: deleting a
     * node from the middle orphans every reply beneath it, and the reader is
     * left with a conversation that answers questions nobody asked.
     *
     * Comments held for any other reason — a site that moderates every new
     * comment — stay out, as they always have.
     *
     * Typed loosely because get_comments() is only documented to return an
     * array — with the wrong arguments it answers ids or counts, and the guard
     * below is what stops one of those being formatted as a comment.
     *
     * @param array<int, mixed> $comments
     *
     * @return array<int, WP_Comment>
     */
    public static function filterVisibleComments(array $comments): array
    {
        return array_values(
            array_filter(
                $comments,
                static function ($comment): bool {
                    if (!$comment instanceof WP_Comment) {
                        return false;
                    }

                    return (string) $comment->comment_approved === '1'
                        || self::isCommentHidden($comment);
                }
            )
        );
    }

    /**
     * What stands in for a hidden comment's words.
     *
     * A marker rather than an empty bubble: a reader following a thread is owed
     * the fact that something was there and is being looked at, which is also
     * why the reply beneath it still makes sense.
     */
    public static function tombstone(): string
    {
        return '<p><em>' . esc_html__('This comment is hidden while a moderator reviews it.', 'bit-connect') . '</em></p>';
    }

    public static function hideComment(int $commentId): bool
    {
        $comment = get_comment($commentId);

        if (!$comment instanceof WP_Comment || self::isCommentHidden($commentId)) {
            return false;
        }

        update_comment_meta($commentId, self::PREV_STATUS_META, (string) $comment->comment_approved);

        if (!wp_set_comment_status($commentId, 'hold')) {
            delete_comment_meta($commentId, self::PREV_STATUS_META);

            return false;
        }

        return true;
    }

    public static function restoreComment(int $commentId): bool
    {
        if (!self::isCommentHidden($commentId)) {
            return false;
        }

        $previous = (string) get_comment_meta($commentId, self::PREV_STATUS_META, true);

        // '1' is approved, '0' was already held. Restoring to held is correct
        // for a comment that was awaiting approval when it got reported.
        $status = $previous === '1' ? 'approve' : 'hold';

        if (!wp_set_comment_status($commentId, $status)) {
            return false;
        }

        delete_comment_meta($commentId, self::PREV_STATUS_META);

        return true;
    }

    // -------------------------------------------------------------------------
    // Dispatch by target type
    // -------------------------------------------------------------------------

    public static function hide(string $targetType, int $targetId): bool
    {
        return $targetType === ReportService::TARGET_COMMENT
            ? self::hideComment($targetId)
            : self::hidePost($targetId);
    }

    public static function restore(string $targetType, int $targetId): bool
    {
        return $targetType === ReportService::TARGET_COMMENT
            ? self::restoreComment($targetId)
            : self::restorePost($targetId);
    }

    public static function isHidden(string $targetType, int $targetId): bool
    {
        return $targetType === ReportService::TARGET_COMMENT
            ? self::isCommentHidden($targetId)
            : self::isPostHidden($targetId);
    }
}
