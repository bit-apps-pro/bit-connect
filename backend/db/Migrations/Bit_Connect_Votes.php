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
 * Migration for the votes table: one row per (user, topic).
 *
 * The table holds upvotes on topics, which is the whole of what this plugin
 * lets a member vote on. There is no comment column in this schema: a plugin
 * that implemented reply upvoting would add `comment_id` and its unique index
 * itself, in its own migration. Nothing here creates, reads or writes it.
 *
 * Handles two cases:
 *   - Fresh install: create the table with the current one-row-per-vote schema.
 *   - Upgrade: an existing install may still carry the legacy schema
 *     (`vote_type ENUM NOT NULL` and unique indexes that include it). Because
 *     Schema::create emits CREATE TABLE IF NOT EXISTS it is a no-op on those
 *     installs, so the legacy `vote_type NOT NULL` column survives and every
 *     new INSERT (user_id, post_id only) fails silently. The upgrade path
 *     performs a real ALTER: drop the legacy indexes, de-duplicate, drop the
 *     legacy column, and create the unique index by name.
 */
final class Bit_Connect_Votes extends Migration
{
    public function up(): void
    {
        $prefix = Connection::wpPrefix() . Config::VAR_PREFIX;
        $tableName = $prefix . 'votes';

        if (!$this->tableExists($tableName)) {
            Schema::withPrefix($prefix)->create(
                'votes',
                function (Blueprint $table): void {
                    $table->id();
                    $table->bigint('post_id')->unsigned()->nullable()->index();
                    $table->bigint('user_id')->unsigned()->index();
                    $table->timestamps();
                }
            );

            $this->ensureUniqueIndexes($tableName);

            return;
        }

        // Table already exists — reconcile it with the current schema.
        $this->upgradeExistingTable($tableName);
    }

    public function down(): void
    {
        Schema::withPrefix(Connection::wpPrefix() . Config::VAR_PREFIX)->drop('votes');
    }

    /**
     * Bring a pre-existing (possibly legacy) votes table up to the current schema.
     *
     * Everything but the last line is guarded on the one marker of the legacy
     * schema, the `vote_type` column. A table without it is already current —
     * or carries another plugin's `comment_id` beside this plugin's columns,
     * which a blind drop-and-recreate of the indexes would disturb for no
     * reason.
     */
    private function upgradeExistingTable(string $tableName): void
    {
        if ($this->columnExists($tableName, 'vote_type')) {
            // Both legacy unique indexes include vote_type and share the names
            // this schema wants, so they go first: it avoids "duplicate index
            // name", and it lifts the uniqueness constraint that the DROP
            // COLUMN below would otherwise violate.
            //
            // `unique_comment_vote` is dropped and not recreated. Reply votes
            // are not this plugin's, so neither is the index over them: a
            // plugin that implements reply upvoting de-duplicates the rows and
            // adds the index back in its own migration.
            $this->dropIndexIfExists($tableName, 'unique_post_vote');
            $this->dropIndexIfExists($tableName, 'unique_comment_vote');

            // One row per (user, topic) before the unique key goes back on:
            // the legacy schema allowed an up row and a down row per target.
            $this->dedupe($tableName, 'post_id');

            // The legacy NOT NULL column that blocks new inserts.
            $this->runOrFail("ALTER TABLE `{$tableName}` DROP COLUMN `vote_type`");
        }

        $this->ensureUniqueIndexes($tableName);
    }

    /**
     * Delete duplicate rows for a given target column, keeping the lowest id.
     * NULLs never conflict, so rows for the other vote target are untouched.
     */
    private function dedupe(string $tableName, string $targetColumn): void
    {
        $sql = sprintf(
            <<<'SQL'
                DELETE v1 FROM `%1$s` v1
                INNER JOIN `%1$s` v2
                ON v1.user_id = v2.user_id
                AND v1.`%2$s` = v2.`%2$s`
                AND v1.`%2$s` IS NOT NULL
                AND v1.id > v2.id
                SQL,
            $tableName,
            $targetColumn
        );

        $this->runOrFail($sql);
    }

    /**
     * Create the unique index only if it is absent (idempotent).
     */
    private function ensureUniqueIndexes(string $tableName): void
    {
        if (!$this->indexExists($tableName, 'unique_post_vote')) {
            $this->runOrFail(
                "ALTER TABLE `{$tableName}` ADD UNIQUE INDEX `unique_post_vote` (`user_id`, `post_id`)"
            );
        }
    }

    private function dropIndexIfExists(string $tableName, string $indexName): void
    {
        if ($this->indexExists($tableName, $indexName)) {
            $this->runOrFail("ALTER TABLE `{$tableName}` DROP INDEX `{$indexName}`");
        }
    }

    private function tableExists(string $tableName): bool
    {
        $found = Connection::get_var('SHOW TABLES LIKE ' . $this->quote($tableName));

        return $found === $tableName;
    }

    private function columnExists(string $tableName, string $column): bool
    {
        $row = Connection::get_row(
            "SHOW COLUMNS FROM `{$tableName}` LIKE " . $this->quote($column)
        );

        return !empty($row);
    }

    private function indexExists(string $tableName, string $indexName): bool
    {
        $rows = Connection::get_results(
            "SHOW INDEX FROM `{$tableName}` WHERE Key_name = " . $this->quote($indexName)
        );

        return !empty($rows);
    }

    /**
     * Run a query and fail loudly rather than silently swallowing DB errors.
     */
    private function runOrFail(string $sql): void
    {
        $result = Connection::query($sql);

        if ($result === false) {
            $error = Connection::prop('last_error');

            throw new RuntimeException(esc_html("Votes migration failed: {$error} — while running: {$sql}"));
        }
    }

    private function quote(string $value): string
    {
        return "'" . esc_sql($value) . "'";
    }
}
