<?php

use BitApps\BitConnect\Deps\BitApps\WPDatabase\Connection;
use BitApps\BitConnect\Deps\BitApps\WPKit\Migration\Migration;
use BitApps\BitConnect\Enum\PostTypes;
use BitApps\BitConnect\Services\StageHistoryService;

if (!defined('ABSPATH')) {
    exit;
}

/**
 * Dates the stage of every topic from before StageHistoryService kept one.
 *
 * WordPress keeps no history of a post's terms, so for those topics the last
 * time each was modified stands in — moving a topic from its edit screen saves
 * it, so for most it is the move itself. Written once, here, rather than the
 * first time a reader happens to open the roadmap: a page view should not
 * write to the database, and a later edit must not drag the date forward.
 *
 * Re-runnable: the migration list runs on activation and on every version
 * change, and a topic that already has a date is not selected again — so a
 * real move recorded since is never overwritten.
 */
final class Bit_Connect_StageDates extends Migration
{
    public function up(): void
    {
        $posts = Connection::wpPrefix() . 'posts';
        $postmeta = Connection::wpPrefix() . 'postmeta';

        $rows = (array) Connection::get_results(
            "SELECT p.ID, p.post_modified_gmt FROM `{$posts}` p
             LEFT JOIN `{$postmeta}` m ON m.post_id = p.ID AND m.meta_key = " . $this->quote(StageHistoryService::META_CHANGED_AT) . '
             WHERE p.post_type = ' . $this->quote(PostTypes::BIT_CONNECT->value) . "
               AND m.meta_id IS NULL
               AND p.post_modified_gmt <> '0000-00-00 00:00:00'"
        );

        foreach ($rows as $row) {
            // Through the API rather than one INSERT … SELECT, so a persistent
            // object cache learns of each value instead of serving its stale
            // "no meta" until it expires.
            add_post_meta((int) $row->ID, StageHistoryService::META_CHANGED_AT, (string) $row->post_modified_gmt, true);
        }
    }

    /**
     * Nothing to undo: the dates are what the current build reads, and a
     * topic without one simply shows none.
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
