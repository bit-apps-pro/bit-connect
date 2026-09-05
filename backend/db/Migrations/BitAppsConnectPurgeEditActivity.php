<?php

use BitApps\BitConnect\Config;
use BitApps\BitConnect\Deps\BitApps\WPDatabase\Connection;
use BitApps\BitConnect\Deps\BitApps\WPKit\Migration\Migration;

if (!defined('ABSPATH')) {
    exit;
}

/**
 * Clears the activity rows for an action nothing can take any more.
 *
 * Editing another member's words was withdrawn: PermissionService::canEditPost()
 * and canEditComment() require ownership with no moderator or administrator
 * override, and the controllers keep content changes inside an isOwner branch.
 * The log's edit rows were written by recordIfNotAuthor(), which skips the
 * author — so the only person who can still edit is the one person whose edit is
 * never recorded. `edit_post` and `edit_comment` left the ActivityActions enum
 * with those two facts unable to both be true.
 *
 * This deletes what earlier builds wrote. That is a real cost and worth naming:
 * the log is append-only everywhere else, and these rows held the only surviving
 * copy of a topic or comment as it read before somebody else changed it. What
 * they buy in exchange is a screen that no longer has to explain itself — no
 * "(no longer possible)" filter entry, no per-row badge disowning the row it sits
 * on, no empty state for a search that could only ever come back empty.
 *
 * Re-runnable: the migration list runs on activation and on every version
 * change, and after the first pass there is nothing left to match.
 */
final class BitAppsConnectPurgeEditActivity extends Migration
{
    /**
     * The slugs being removed, matching the cases dropped from ActivityActions.
     */
    private const WITHDRAWN = ['edit_post', 'edit_comment'];

    public function up(): void
    {
        $tableName = Connection::wpPrefix() . Config::VAR_PREFIX . 'activity_log';

        // Ordering in InstallerProvider::migration() puts BitAppsConnectActivityLog
        // first, but a fresh install running the list for the first time should
        // not depend on that to avoid querying a table that is not there yet.
        if (!$this->tableExists($tableName)) {
            return;
        }

        $slugs = implode(', ', array_map([$this, 'quote'], self::WITHDRAWN));

        $result = Connection::query("DELETE FROM `{$tableName}` WHERE `action` IN ({$slugs})");

        if ($result === false) {
            $error = Connection::prop('last_error');

            throw new RuntimeException("Purging withdrawn activity actions failed: {$error}");
        }
    }

    /**
     * Nothing to undo — the rows are gone, and inventing replacements would be
     * worse than the gap. Dropping the table is BitAppsConnectActivityLog's job.
     */
    public function down(): void
    {
        // Deliberately empty; see above. The comment also keeps the body from
        // being collapsed to `{}` by php-cs-fixer, which phpcs then rejects.
    }

    private function tableExists(string $tableName): bool
    {
        return Connection::get_var('SHOW TABLES LIKE ' . $this->quote($tableName)) === $tableName;
    }

    private function quote(string $value): string
    {
        return "'" . esc_sql($value) . "'";
    }
}
