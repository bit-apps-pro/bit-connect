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
 * Migration for the follows table.
 *
 * Who has asked to hear about what. A follow is the only thing standing between
 * "notify the author" and a forum that can tell forty people about one reply, so
 * this table is what makes the notification system more than a mention system.
 *
 * Two design notes worth keeping:
 *
 *   - `muted` is a column, not the absence of a row. Follows arrive two ways:
 *     a member presses Follow, or they take part in a thread and are subscribed
 *     automatically. Unfollowing by deleting the row works for the first and
 *     fails for the second — their next reply would resubscribe them, and from
 *     the member's side the forum would look like it had ignored them. Muting is
 *     a standing answer that auto-follow cannot overwrite.
 *
 *   - `target_type` is open (topic, department, tag, forum) rather than a topic
 *     id column. Following a product so you hear about new topics in it is the
 *     same question as following a thread, and splitting them into two tables
 *     would mean two of every query above this line.
 */
final class Bit_Connect_Follows extends Migration
{
    public function up(): void
    {
        $prefix = Connection::wpPrefix() . Config::VAR_PREFIX;
        $tableName = $prefix . 'follows';

        if ($this->tableExists($tableName)) {
            $this->ensureIndexes($tableName);

            return;
        }

        Schema::withPrefix($prefix)->create(
            'follows',
            function (Blueprint $table): void {
                $table->id();
                $table->bigint('user_id')->unsigned();
                // topic | department | tag | forum
                $table->varchar('target_type', 16);
                $table->bigint('target_id')->unsigned();
                // auto | manual. Kept so the UI can tell "you are following this
                // because you replied" from "you chose to follow this", which are
                // different sentences to a member deciding whether to mute.
                $table->varchar('source', 8);
                $table->tinyint('muted', 1)->unsigned()->defaultValue(0);
                $table->timestamps();
            }
        );

        $this->ensureIndexes($tableName);
    }

    public function down(): void
    {
        Schema::withPrefix(Connection::wpPrefix() . Config::VAR_PREFIX)->drop('follows');
    }

    private function ensureIndexes(string $tableName): void
    {
        // One follow per person per thing. Enforced by the database rather than
        // by a check-then-insert: auto-follow fires on the same request as the
        // comment that triggered it, and two quick submissions would race past
        // a read.
        if (!$this->indexExists($tableName, 'unique_follow')) {
            $this->runOrFail(
                "ALTER TABLE `{$tableName}` ADD UNIQUE INDEX `unique_follow` (`user_id`, `target_type`, `target_id`)"
            );
        }

        // The dispatch-time question: who follows this thread and has not muted
        // it? Run once per notifiable event, so it has to be an index lookup and
        // not a filter over everyone's follows.
        if (!$this->indexExists($tableName, 'target_followers')) {
            $this->runOrFail(
                "ALTER TABLE `{$tableName}` ADD INDEX `target_followers` (`target_type`, `target_id`, `muted`)"
            );
        }

        // "What am I following?" — the member's own list.
        if (!$this->indexExists($tableName, 'user_follows')) {
            $this->runOrFail(
                "ALTER TABLE `{$tableName}` ADD INDEX `user_follows` (`user_id`, `target_type`, `muted`)"
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

            throw new RuntimeException(esc_html("Follows migration failed: {$error} — while running: {$sql}"));
        }
    }

    private function quote(string $value): string
    {
        return "'" . esc_sql($value) . "'";
    }
}
