<?php

use BitApps\BitConnect\Deps\BitApps\WPDatabase\Connection;
use BitApps\BitConnect\Deps\BitApps\WPKit\Migration\Migration;
use BitApps\BitConnect\Enum\PostTypes;
use BitApps\BitConnect\Services\UploadClaims;

if (!defined('ABSPATH')) {
    exit;
}

/**
 * Marks the files members uploaded before the portal marked its uploads.
 *
 * ForumUploadsInLibrary keeps attachments carrying UploadClaims::PORTAL_META
 * out of the Media Library. Uploads from earlier builds carry no mark and
 * stayed listed, so this marks what can only have come from the portal: the
 * files attached to a topic, the files on a comment, and members' profile
 * pictures and covers.
 *
 * Only the portal mark, never the pending one: these are in use, and the
 * cleanup must not take them.
 *
 * Re-runnable: the migration list runs on activation and on every version
 * change, and a file already marked is not selected again.
 */
final class Bit_Connect_MarkPortalUploads extends Migration
{
    public function up(): void
    {
        $posts = Connection::wpPrefix() . 'posts';
        $postmeta = Connection::wpPrefix() . 'postmeta';
        $commentmeta = Connection::wpPrefix() . 'commentmeta';
        $usermeta = Connection::wpPrefix() . 'usermeta';
        $mark = $this->quote(UploadClaims::PORTAL_META);

        $ids = (array) Connection::get_col(
            "SELECT a.ID FROM `{$posts}` a
             INNER JOIN `{$posts}` t ON t.ID = a.post_parent
             WHERE a.post_type = 'attachment' AND t.post_type = " . $this->quote(PostTypes::BIT_CONNECT->value)
        );

        $ids = array_merge(
            $ids,
            (array) Connection::get_col(
                "SELECT meta_value FROM `{$usermeta}` WHERE meta_key IN ('bit_connect_avatar_id', 'bit_connect_cover_id')"
            )
        );

        $commentFiles = (array) Connection::get_col(
            "SELECT meta_value FROM `{$commentmeta}` WHERE meta_key = '_bit_connect_comment_attachments'"
        );
        foreach ($commentFiles as $value) {
            $ids = array_merge($ids, (array) maybe_unserialize($value));
        }

        $ids = array_values(array_unique(array_filter(array_map('intval', $ids))));
        if ($ids === []) {
            return;
        }

        $marked = array_map(
            'intval',
            (array) Connection::get_col(
                "SELECT post_id FROM `{$postmeta}` WHERE meta_key = {$mark} AND post_id IN (" . implode(',', $ids) . ')'
            )
        );

        foreach (array_diff($ids, $marked) as $id) {
            if (get_post_type($id) === 'attachment') {
                UploadClaims::markPortal($id);
            }
        }
    }

    /**
     * Nothing to undo: an unmarked upload only shows in the Media Library
     * again, and the mark is what the current build expects to find.
     */
    public function down(): void
    {
        // Deliberately empty; see above. The comment also keeps the body from
        // being collapsed to `{}` by php-cs-fixer, which phpcs then rejects.
    }

    private function quote(string $value): string
    {
        return "'" . esc_sql($value) . "'";
    }
}
