<?php

namespace BitApps\BitConnect\Services;

// Prevent direct script access
if (!defined('ABSPATH')) {
    exit;
}

/**
 * Uploads that no post has used yet, and clearing them away.
 *
 * A file reaches the media library the moment a member picks it, long before
 * the topic or comment it is for is saved — and often it never is: the modal
 * is closed, the video is taken out of the text again, the upload finishes
 * after the member gave up on it. Each upload is marked pending when it
 * arrives, the mark comes off when a saved post uses it, and the daily cleanup
 * deletes whatever is still pending a day later.
 *
 * Only uploads made through the portal carry the mark, so nothing an
 * administrator put in the media library, and nothing uploaded before this
 * existed, is ever considered.
 */
final class UploadClaims
{
    /** Post meta holding when an unused upload arrived. */
    public const PENDING_META = '_bit_connect_pending_upload';

    /** Post meta marking an attachment as one a member uploaded through the portal. */
    public const PORTAL_META = '_bit_connect_portal_upload';

    /** How long an upload may wait for its post before it is cleared away. */
    public const GRACE = DAY_IN_SECONDS;

    /** Uploads deleted per cleanup run, so one run cannot time out on a backlog. */
    private const BATCH = 100;

    public static function markPending(int $attachmentId): void
    {
        if ($attachmentId > 0) {
            update_post_meta($attachmentId, self::PENDING_META, time());
        }
    }

    /**
     * Mark uploads as used by a saved post.
     *
     * @param int[] $attachmentIds
     */
    public static function claim(array $attachmentIds): void
    {
        foreach (self::ids($attachmentIds) as $id) {
            delete_post_meta($id, self::PENDING_META);
        }
    }

    /**
     * Hand uploads a post no longer uses back to the cleanup.
     *
     * Only the portal's own uploads: one an administrator attached from the
     * media library is left alone.
     *
     * @param int[] $attachmentIds
     */
    public static function release(array $attachmentIds): void
    {
        foreach (self::ids($attachmentIds) as $id) {
            if (get_post_meta($id, self::PORTAL_META, true)) {
                self::markPending($id);
            }
        }
    }

    /**
     * Record an upload made through the portal, pending until a post uses it.
     */
    public static function recordUpload(int $attachmentId): void
    {
        if ($attachmentId <= 0) {
            return;
        }

        update_post_meta($attachmentId, self::PORTAL_META, 1);
        self::markPending($attachmentId);
    }

    /**
     * The uploads a post's HTML shows: pictures and videos placed in the text.
     *
     * Read from each `src`, resolved to its attachment by WordPress; an
     * address that is not one of this site's uploads resolves to nothing.
     *
     * @return int[]
     */
    public static function idsInContent(string $html): array
    {
        $ids = [];
        foreach (self::sourcesInContent($html) as $url) {
            $ids[] = (int) attachment_url_to_postid($url);
        }

        return self::ids($ids);
    }

    /**
     * The address of each picture and video placed in a post's HTML, decoded
     * as the browser reads it. No lookup: for checking a known upload against
     * the text, where idsInContent() would cost a query per address.
     *
     * @return string[]
     */
    public static function sourcesInContent(string $html): array
    {
        if (!preg_match_all('/<(?:img|video)\b[^>]*?\ssrc\s*=\s*(["\'])([^"\']+)\1/i', $html, $matches)) {
            return [];
        }

        return array_values(array_unique(array_map(
            static fn (string $url): string => html_entity_decode($url, \ENT_QUOTES),
            $matches[2]
        )));
    }

    /**
     * Delete uploads still unused after the grace period.
     *
     * Attached ones are skipped whatever their mark says: a post holds them.
     */
    public static function cleanup(): void
    {
        $stale = get_posts(
            [
                'post_type'      => 'attachment',
                'post_status'    => 'inherit',
                'post_parent'    => 0,
                'fields'         => 'ids',
                'posts_per_page' => self::BATCH,
                'no_found_rows'  => true,
                'meta_query'     => [
                    [
                        'key'     => self::PENDING_META,
                        'value'   => time() - self::GRACE,
                        'compare' => '<',
                        'type'    => 'NUMERIC',
                    ],
                ],
            ]
        );

        foreach ($stale as $id) {
            wp_delete_attachment((int) $id, true);
        }

        ChunkedUpload::cleanup();
    }

    /**
     * @param array<mixed> $ids
     *
     * @return int[]
     */
    private static function ids(array $ids): array
    {
        return array_values(array_unique(array_filter(array_map('intval', $ids), fn (int $id) => $id > 0)));
    }
}
