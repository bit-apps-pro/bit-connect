<?php

namespace BitApps\BitConnect\Services;

// Prevent direct script access
if (!defined('ABSPATH')) {
    exit;
}

use WP_Comment;
use WP_Post;

/**
 * Deleting a topic or a reply, whoever asked for it.
 *
 * The report queue and the portal's own delete buttons were removing content by
 * two different routes — TopicController::delete through TopicService, and
 * CommentController::delete inline — and a third caller would have made a third.
 * What has to hold in every one of them is the same: a comment's replies go with
 * it rather than being orphaned, a topic's votes go with it rather than being
 * left pointing at nothing, and what was there is read out before it is gone so
 * the activity log has something to say.
 *
 * No capability check lives here. Who may delete is a question about the caller
 * — the author of their own words, or a moderator holding forum_delete_any —
 * and answering it here would let a call site skip asking.
 */
final class ContentRemovalService
{
    /**
     * What was there, read while it still exists.
     *
     * Shaped for the activity log's context blob, which is why the keys differ
     * by type: a topic has a title, a comment has a subtree it takes with it.
     *
     * @return array<string, mixed>
     */
    public static function describe(string $targetType, int $targetId): array
    {
        if ($targetType === ReportService::TARGET_COMMENT) {
            $comment = get_comment($targetId);

            if (!$comment instanceof WP_Comment) {
                return [];
            }

            return [
                'content'      => ActivityLogService::excerpt($comment->comment_content),
                'post'         => (int) $comment->comment_post_ID,
                'replies_lost' => \count(self::replyIds($targetId)),
            ];
        }

        $post = get_post($targetId);

        if (!$post instanceof WP_Post) {
            return [];
        }

        return [
            'post_title'   => (string) $post->post_title,
            'post_content' => ActivityLogService::excerpt($post->post_content),
        ];
    }

    /**
     * Deletes the target. Answers false when there was nothing to delete.
     */
    public static function remove(string $targetType, int $targetId): bool
    {
        return $targetType === ReportService::TARGET_COMMENT
            ? self::removeComment($targetId)
            : (new TopicService())->deleteTopic($targetId);
    }

    /**
     * A comment and everything hanging off it.
     *
     * Replies are deleted rather than reparented: a reply to something that is
     * gone answers a question the reader cannot see, and leaving them behind was
     * what made deleting from the middle of a thread produce nonsense.
     */
    private static function removeComment(int $commentId): bool
    {
        if (!get_comment($commentId) instanceof WP_Comment) {
            return false;
        }

        foreach (self::replyIds($commentId) as $replyId) {
            wp_delete_comment($replyId, true);
        }

        return (bool) wp_delete_comment($commentId, true);
    }

    /**
     * Direct replies to a comment.
     *
     * @return array<int, int>
     */
    private static function replyIds(int $commentId): array
    {
        $children = get_comments(
            [
                'parent' => $commentId,
                'status' => 'any',
                'fields' => 'ids',
            ]
        );

        return array_map('intval', (array) $children);
    }
}
