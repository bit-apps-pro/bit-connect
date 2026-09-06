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
 * Migration for the activity log.
 *
 * A row here outlives the thing it describes, which is the whole reason the
 * table exists. Edit attribution lives in post and comment meta and answers
 * "who last touched this" for a row that still exists; it cannot answer "who
 * deleted this topic", because by then there is no row left to hang meta on,
 * and it cannot hold more than the most recent edit.
 *
 * Deliberately not foreign-keyed to posts or comments. The rows it points at
 * get deleted — that is the case being recorded — so a constraint would either
 * refuse the delete or cascade away the evidence.
 */
final class Bit_Connect_ActivityLog extends Migration
{
    public function up(): void
    {
        $prefix = Connection::wpPrefix() . Config::VAR_PREFIX;
        $tableName = $prefix . 'activity_log';

        if ($this->tableExists($tableName)) {
            $this->ensureIndexes($tableName);

            return;
        }

        Schema::withPrefix($prefix)->create(
            'activity_log',
            function (Blueprint $table): void {
                $table->id();
                // 0 for anything the system did on nobody's behalf, so the
                // column never has to be nullable to say "not a person".
                $table->bigint('actor_id')->unsigned()->index();
                $table->varchar('action', 32)->index();
                // post | comment. Not an ENUM: adding a third kind of target
                // would otherwise need an ALTER on a table that only ever grows.
                $table->varchar('target_type', 16);
                $table->bigint('target_id')->unsigned();
                // Kept as a plain column rather than looked up later, because
                // the target may be gone by the time anyone reads this row.
                $table->bigint('target_author')->unsigned()->index();
                $table->text('reason')->nullable();
                // JSON: before/after excerpts, revision id, report ids. Free
                // text by design — what is worth keeping differs per action.
                $table->longtext('context')->nullable();
                $table->timestamps();
            }
        );

        $this->ensureIndexes($tableName);
    }

    public function down(): void
    {
        Schema::withPrefix(Connection::wpPrefix() . Config::VAR_PREFIX)->drop('activity_log');
    }

    /**
     * The composite index the feed actually reads by: "everything that happened
     * to this topic". Added by name so a re-run cannot duplicate it.
     */
    private function ensureIndexes(string $tableName): void
    {
        if (!$this->indexExists($tableName, 'target_lookup')) {
            $this->runOrFail(
                "ALTER TABLE `{$tableName}` ADD INDEX `target_lookup` (`target_type`, `target_id`)"
            );
        }

        // The admin feed is ordered newest-first and paginated; without this it
        // filesorts the whole table to render ten rows.
        if (!$this->indexExists($tableName, 'created_at_idx')) {
            $this->runOrFail(
                "ALTER TABLE `{$tableName}` ADD INDEX `created_at_idx` (`created_at`)"
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

    /**
     * Run a query and fail loudly rather than silently swallowing DB errors.
     */
    private function runOrFail(string $sql): void
    {
        $result = Connection::query($sql);

        if ($result === false) {
            $error = Connection::prop('last_error');

            throw new RuntimeException(esc_html("Activity log migration failed: {$error} — while running: {$sql}"));
        }
    }

    private function quote(string $value): string
    {
        return "'" . esc_sql($value) . "'";
    }
}
