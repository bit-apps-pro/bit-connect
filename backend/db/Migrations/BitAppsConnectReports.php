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
 * Migration for the reports table.
 *
 * Many rows per target, each with its own reporter, reason and resolution —
 * which is why this cannot live in meta the way edit attribution does.
 *
 * Like the activity log, nothing here is foreign-keyed to posts or comments: a
 * report can outlive the thing it was made about, and frequently should. When a
 * moderator resolves a report by removing the content, the report is the record
 * of why it went.
 */
final class BitAppsConnectReports extends Migration
{
    public function up(): void
    {
        $prefix = Connection::wpPrefix() . Config::VAR_PREFIX;
        $tableName = $prefix . 'reports';

        if ($this->tableExists($tableName)) {
            $this->ensureIndexes($tableName);

            return;
        }

        Schema::withPrefix($prefix)->create(
            'reports',
            function (Blueprint $table): void {
                $table->id();
                $table->varchar('target_type', 16);
                $table->bigint('target_id')->unsigned();
                // Stored rather than looked up: the target may be removed as a
                // result of this very report.
                $table->bigint('target_author')->unsigned()->index();
                $table->bigint('reporter_id')->unsigned()->index();
                $table->varchar('reason', 32);
                $table->text('details')->nullable();
                $table->varchar('status', 16)->index();
                $table->bigint('resolved_by')->unsigned()->nullable();
                $table->timestamp('resolved_at')->nullable();
                $table->text('resolution_note')->nullable();
                $table->timestamps();
            }
        );

        $this->ensureIndexes($tableName);
    }

    public function down(): void
    {
        Schema::withPrefix(Connection::wpPrefix() . Config::VAR_PREFIX)->drop('reports');
    }

    private function ensureIndexes(string $tableName): void
    {
        // One report per person per item. Enforced by the database rather than
        // by a check-then-insert, which two clicks in quick succession would
        // race straight past.
        if (!$this->indexExists($tableName, 'unique_reporter_target')) {
            $this->runOrFail(
                "ALTER TABLE `{$tableName}` ADD UNIQUE INDEX `unique_reporter_target` (`reporter_id`, `target_type`, `target_id`)"
            );
        }

        // The queue groups by target and filters by status; this is the read it
        // does on every page load.
        if (!$this->indexExists($tableName, 'target_status')) {
            $this->runOrFail(
                "ALTER TABLE `{$tableName}` ADD INDEX `target_status` (`target_type`, `target_id`, `status`)"
            );
        }

        // The queue's own query is `WHERE status = ? ORDER BY created_at DESC`,
        // which neither of the above serves: `status` alone finds the rows and
        // then MySQL sorts them, and target_status is led by the wrong column.
        // Ordering the index the way the query reads it removes the filesort,
        // which is what decides whether the 1000-row cap is ever felt.
        if (!$this->indexExists($tableName, 'status_created')) {
            $this->runOrFail(
                "ALTER TABLE `{$tableName}` ADD INDEX `status_created` (`status`, `created_at`)"
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

            throw new RuntimeException("Reports migration failed: {$error} — while running: {$sql}");
        }
    }

    private function quote(string $value): string
    {
        return "'" . esc_sql($value) . "'";
    }
}
