<?php

namespace BitApps\BitConnect\Services;

// Prevent direct script access
if (!defined('ABSPATH')) {
    exit;
}

use WP_Comment;
use WP_Post;

/**
 * Who last edited a topic or comment, and when.
 *
 * Two readings come out of the same record. An author editing their own words
 * gets the plain "(edited)" every forum shows. Someone else editing them gets a
 * byline — "Edited by Rahim" — because on this forum that is a colleague
 * correcting a teammate's reply, not a moderator acting against a member. The
 * caller decides which to print from `by_author`; this only reports the fact.
 *
 * Stored in meta rather than read off the row:
 *
 *   - wp_comments has no modified column at all. comment_date is the only
 *     timestamp a comment carries, so without this there is nothing to compare.
 *   - post_modified exists but cannot answer the question. Pinning or locking a
 *     topic calls wp_update_post(), which bumps it without a word of the topic
 *     changing, so a pinned topic would claim to have been edited.
 *
 * Nothing records itself: the write sites decide what counts as a content
 * change, and only call record*() when one really happened.
 */
final class EditAttributionService
{
    private const META_AT = '_bc_edited_at';

    private const META_BY = '_bc_edited_by';

    /**
     * Marks a topic as edited by the given user, now.
     */
    public static function recordPost(int $postId, int $editorId): void
    {
        if ($postId <= 0 || $editorId <= 0) {
            return;
        }

        update_post_meta($postId, self::META_AT, current_time('mysql', true));
        update_post_meta($postId, self::META_BY, $editorId);
    }

    /**
     * Marks a comment as edited by the given user, now.
     */
    public static function recordComment(int $commentId, int $editorId): void
    {
        if ($commentId <= 0 || $editorId <= 0) {
            return;
        }

        update_comment_meta($commentId, self::META_AT, current_time('mysql', true));
        update_comment_meta($commentId, self::META_BY, $editorId);
    }

    /**
     * Edit attribution for a topic, or null when it has never been edited.
     *
     * @return null|array{at: string, by: int, by_name: string, by_slug: string, by_author: bool}
     */
    public static function forPost(int $postId): ?array
    {
        $post = get_post($postId);

        if (!$post instanceof WP_Post) {
            return null;
        }

        return self::build(
            (string) get_post_meta($postId, self::META_AT, true),
            (int) get_post_meta($postId, self::META_BY, true),
            (int) $post->post_author
        );
    }

    /**
     * Edit attribution for a comment, or null when it has never been edited.
     *
     * @return null|array{at: string, by: int, by_name: string, by_slug: string, by_author: bool}
     */
    public static function forComment(int $commentId): ?array
    {
        $comment = get_comment($commentId);

        if (!$comment instanceof WP_Comment) {
            return null;
        }

        return self::build(
            (string) get_comment_meta($commentId, self::META_AT, true),
            (int) get_comment_meta($commentId, self::META_BY, true),
            (int) $comment->user_id
        );
    }

    /**
     * Whether any of a topic's readable fields differ from what is stored.
     *
     * Only the words count. An update carrying nothing but is_pinned or
     * is_locked leaves every one of these untouched, which is exactly why a
     * pinned topic must not come out of it claiming to have been edited.
     *
     * @param array<string, mixed> $data the incoming update
     */
    public static function postContentChanged(WP_Post $existing, array $data): bool
    {
        foreach (['post_title', 'post_content', 'post_excerpt'] as $field) {
            if (!\array_key_exists($field, $data)) {
                continue;
            }

            if ((string) $data[$field] !== (string) $existing->{$field}) {
                return true;
            }
        }

        return false;
    }

    /**
     * Assembles the reported shape, or null when there is nothing to report.
     *
     * @return null|array{at: string, by: int, by_name: string, by_slug: string, by_author: bool}
     */
    private static function build(string $at, int $by, int $authorId): ?array
    {
        if ($at === '' || $by <= 0) {
            return null;
        }

        $editor = get_userdata($by);

        return [
            'at' => $at,
            'by' => $by,
            // Empty when the editor's account is gone. The portal falls back to
            // a plain "(edited)" rather than printing "Edited by " and nothing.
            'by_name'   => $editor ? $editor->display_name : '',
            'by_slug'   => $editor ? ProfileSlugService::slugFor($by) : '',
            'by_author' => $by === $authorId,
        ];
    }
}
