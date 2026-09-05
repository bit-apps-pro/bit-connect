<?php

namespace BitApps\BitConnect\Model;

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
     * @return array<int, object>
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

        return $rows;
    }

    public static function pendingCount(string $targetType, int $targetId): int
    {
        return \count(self::pendingFor($targetType, $targetId));
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
