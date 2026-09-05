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
 * Migration for the votes table.
 *
 * Handles two cases:
 *   - Fresh install: create the table with the current one-row-per-vote schema.
 *   - Upgrade: an existing install may still carry the legacy schema
 *     (`vote_type ENUM NOT NULL`, no `comment_id`, and unique indexes that
 *     include `vote_type`). Because Schema::create emits CREATE TABLE IF NOT
 *     EXISTS it is a no-op on those installs, so the legacy `vote_type NOT NULL`
 *     column survives and every new INSERT (user_id, post_id only) fails
 *     silently. This migration performs a real ALTER: add the new column,
 *     de-duplicate rows, drop the legacy column, and (re)create the unique
 *     indexes by name.
 */
final class BitAppsConnectVotes extends Migration
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
                    $table->bigint('comment_id')->unsigned()->nullable()->index();
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
     */
    private function upgradeExistingTable(string $tableName): void
    {
        // A legacy install may be missing comment_id entirely (post votes only).
        if (!$this->columnExists($tableName, 'comment_id')) {
            $this->runOrFail(
                "ALTER TABLE `{$tableName}` ADD COLUMN `comment_id` BIGINT UNSIGNED NULL AFTER `post_id`, ADD INDEX `comment_id` (`comment_id`)"
            );
        }

        // Drop the legacy unique indexes (they include vote_type and share the
        // names we want to reuse). Doing this first avoids "duplicate index name".
        $this->dropIndexIfExists($tableName, 'unique_post_vote');
        $this->dropIndexIfExists($tableName, 'unique_comment_vote');

        // De-duplicate before adding the unique keys: the legacy schema allowed
        // one up and one down row per (user, target); collapse to a single row.
        $this->dedupe($tableName, 'post_id');
        $this->dedupe($tableName, 'comment_id');

        // Drop the legacy NOT NULL column that blocks new inserts.
        if ($this->columnExists($tableName, 'vote_type')) {
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
        $sql = <<<SQL
            DELETE v1 FROM `{$tableName}` v1
            INNER JOIN `{$tableName}` v2
            ON v1.user_id = v2.user_id
            AND v1.`{$targetColumn}` = v2.`{$targetColumn}`
            AND v1.`{$targetColumn}` IS NOT NULL
            AND v1.id > v2.id
            SQL;

        $this->runOrFail($sql);
    }

    /**
     * Create the unique indexes only if they are absent (idempotent).
     */
    private function ensureUniqueIndexes(string $tableName): void
    {
        if (!$this->indexExists($tableName, 'unique_post_vote')) {
            $this->runOrFail(
                "ALTER TABLE `{$tableName}` ADD UNIQUE INDEX `unique_post_vote` (`user_id`, `post_id`)"
            );
        }

        if (!$this->indexExists($tableName, 'unique_comment_vote')) {
            $this->runOrFail(
                "ALTER TABLE `{$tableName}` ADD UNIQUE INDEX `unique_comment_vote` (`user_id`, `comment_id`)"
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

            throw new RuntimeException("Votes migration failed: {$error} — while running: {$sql}");
        }
    }

    private function quote(string $value): string
    {
        return "'" . esc_sql($value) . "'";
    }
}
