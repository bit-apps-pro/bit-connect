<?php

use BitApps\BitConnect\Config;
use BitApps\BitConnect\Deps\BitApps\WPDatabase\Blueprint;
use BitApps\BitConnect\Deps\BitApps\WPDatabase\Connection;
use BitApps\BitConnect\Deps\BitApps\WPDatabase\Schema;
use BitApps\BitConnect\Deps\BitApps\WPKit\Migration\Migration;

if (!defined('ABSPATH')) {
    exit;
}

/**
 * Migration for the notifications table.
 *
 * One row per recipient per event — the fan-out happens on write, not on read.
 * That is the trade this table is built around: a reply to a topic with forty
 * followers costs forty inserts once, and in exchange the bell in the header
 * costs one indexed count on every page load, for every member, forever. The
 * other way round — deriving each member's notifications from the event stream
 * at read time — makes the cheap thing expensive and the expensive thing rare.
 *
 * Like reports and the activity log, nothing here is foreign-keyed to wp_posts
 * or wp_comments, and for the same reason sharpened: the single most important
 * notification this forum sends is "your content was removed", and a foreign key
 * would delete it at exactly the moment it became true. `context` carries a
 * stored title and excerpt so a row still reads as a sentence after its target
 * is gone.
 */
final class Bit_Connect_Notifications extends Migration
{
    public function up(): void
    {
        $prefix = Connection::wpPrefix() . Config::VAR_PREFIX;
        $tableName = $prefix . 'notifications';

        if ($this->tableExists($tableName)) {
            $this->ensureIndexes($tableName);

            return;
        }

        Schema::withPrefix($prefix)->create(
            'notifications',
            function (Blueprint $table): void {
                $table->id();
                // The recipient. Every read this table serves is "mine", so this
                // leads every index below.
                $table->bigint('user_id')->unsigned();
                $table->varchar('type', 32);
                // Nullable because some events have no person behind them — an
                // auto-hide crossing the report threshold is the rule acting,
                // not a moderator, and naming one would be a lie.
                $table->bigint('actor_id')->unsigned()->nullable();
                $table->varchar('target_type', 16);
                $table->bigint('target_id')->unsigned();
                // The thread this belongs to, kept alongside the target so a
                // comment notification can be turned into a link without
                // loading the comment — which may no longer exist.
                $table->bigint('topic_id')->unsigned()->nullable();
                // JSON. Stored rather than looked up, so the row survives the
                // deletion of whatever it describes.
                $table->text('context')->nullable();
                // How many times this collapsed event has happened. Named in
                // full because `count` reads as the function everywhere it
                // appears in a query.
                $table->int('event_count')->unsigned()->defaultValue(1);
                $table->timestamp('read_at')->nullable();
                // Null means the digest has not taken this row yet. Instant
                // sends stamp it immediately, which is what keeps a member who
                // switches to daily from being sent yesterday again.
                $table->timestamp('emailed_at')->nullable();
                $table->timestamps();
            }
        );

        $this->ensureIndexes($tableName);
    }

    public function down(): void
    {
        Schema::withPrefix(Connection::wpPrefix() . Config::VAR_PREFIX)->drop('notifications');
    }

    private function ensureIndexes(string $tableName): void
    {
        // The unread badge: `WHERE user_id = ? AND read_at IS NULL`. This runs
        // on every page load of the portal for every logged-in member, which
        // makes it the most-executed query the plugin owns. `id` rides along so
        // the count never touches the table itself.
        if (!$this->indexExists($tableName, 'user_unread')) {
            $this->runOrFail(
                "ALTER TABLE `{$tableName}` ADD INDEX `user_unread` (`user_id`, `read_at`, `id`)"
            );
        }

        // The list page: one member's rows, newest first. Ordered the way the
        // query reads so MySQL does not sort the result itself — the same
        // reasoning as `status_created` on the reports table.
        if (!$this->indexExists($tableName, 'user_created')) {
            $this->runOrFail(
                "ALTER TABLE `{$tableName}` ADD INDEX `user_created` (`user_id`, `created_at`)"
            );
        }

        // The collapse probe, run before every insert of a collapsible type:
        // "does this member already have an unread notification about this
        // exact thing?" Without it, the read that makes votes bearable would
        // cost a scan on the busiest write path in the table.
        if (!$this->indexExists($tableName, 'collapse_lookup')) {
            $this->runOrFail(
                "ALTER TABLE `{$tableName}` ADD INDEX `collapse_lookup` (`user_id`, `type`, `target_type`, `target_id`)"
            );
        }

        // The digest sweep: everything never emailed, oldest first. Led by
        // `emailed_at` because the sweep is the one query in this table that is
        // not about a single member.
        if (!$this->indexExists($tableName, 'email_pending')) {
            $this->runOrFail(
                "ALTER TABLE `{$tableName}` ADD INDEX `email_pending` (`emailed_at`, `created_at`)"
            );
        }

        // The retention job deletes read rows past their age. Read rows only —
        // an unread notification is never pruned, because nobody has seen it.
        if (!$this->indexExists($tableName, 'read_created')) {
            $this->runOrFail(
                "ALTER TABLE `{$tableName}` ADD INDEX `read_created` (`read_at`, `created_at`)"
            );
        }
    }

    private function tableExists(string $tableName): bool
    {
        $found = Connection::get_var('SHOW TABLES LIKE ' . $this->quote($tableName));

        return $found === $tableName;
    }

    private function indexExists(string $tableName, string $indexName): bool
    {
        $rows = Connection::get_results(
            "SHOW INDEX FROM `{$tableName}` WHERE Key_name = " . $this->quote($indexName)
        );

        return !empty($rows);
    }

    private function runOrFail(string $sql): void
    {
        $result = Connection::query($sql);

        if ($result === false) {
            $error = Connection::prop('last_error');

            throw new RuntimeException(esc_html("Notifications migration failed: {$error} — while running: {$sql}"));
        }
    }

    private function quote(string $value): string
    {
        return "'" . esc_sql($value) . "'";
    }
}
