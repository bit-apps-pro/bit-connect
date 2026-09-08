<?php

namespace BitApps\BitConnect\Model;

use BitApps\BitConnect\Deps\BitApps\WPDatabase\Collection;
use BitApps\BitConnect\Deps\BitApps\WPDatabase\Model;

/**
 * Test double for the Report model.
 *
 * Rows live in $GLOBALS['__bc_reports'], each an array shaped like the table's.
 * Loaded from bootstrap.php before the Composer autoloader, like the other
 * model doubles.
 *
 * Extends the real Model so the `instanceof Model` guard in
 * ReportService::pendingReporterIds() means what it means in production —
 * pinning that guard was one of the reasons this double exists.
 */
class Report extends Model
{
    /**
     * @param array<string, mixed> $attributes
     *
     * @return false|self
     */
    public static function insert(array $attributes)
    {
        if (!empty($GLOBALS['__bc_report_insert_fails'])) {
            return false;
        }

        $id = \count($GLOBALS['__bc_reports'] ?? []) + 1;

        $GLOBALS['__bc_reports'][] = array_merge(
            ['id' => $id, 'resolved_at' => null, 'resolved_by' => null, 'resolution_note' => null],
            $attributes
        );

        return new self();
    }

    /**
     * Every open report on one target.
     *
     * Answers with a plain array by default, and with a Collection when
     * `$GLOBALS['__bc_reports_as_collection']` is set — which is what the real
     * model does, because wp-database's get() has returned a Collection since
     * 2.0.5. Casting one of those to an array yields its protected $items
     * under a mangled key rather than the rows, and the moderation queue showed
     * a single all-zero card as a result. Tests that want the production shape
     * turn the flag on.
     *
     * @return array<int, object>|Collection
     */
    public static function pendingFor(string $targetType, int $targetId)
    {
        $rows = [];

        foreach ($GLOBALS['__bc_reports'] ?? [] as $row) {
            if (
                ($row['target_type'] ?? '') === $targetType
                && (int) ($row['target_id'] ?? 0) === $targetId
                && ($row['status'] ?? '') === 'pending'
            ) {
                $rows[] = (object) $row;
            }
        }

        return empty($GLOBALS['__bc_reports_as_collection']) ? $rows : new Collection($rows);
    }

    public static function pendingCount(string $targetType, int $targetId): int
    {
        $rows = self::pendingFor($targetType, $targetId);

        return $rows instanceof Collection ? \count($rows->all()) : \count($rows);
    }

    public static function alreadyReported(int $reporterId, string $targetType, int $targetId): bool
    {
        foreach ($GLOBALS['__bc_reports'] ?? [] as $row) {
            if (
                (int) ($row['reporter_id'] ?? 0) === $reporterId
                && ($row['target_type'] ?? '') === $targetType
                && (int) ($row['target_id'] ?? 0) === $targetId
                && ($row['status'] ?? '') === 'pending'
            ) {
                return true;
            }
        }

        return false;
    }
}
