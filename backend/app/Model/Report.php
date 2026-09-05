<?php

namespace BitApps\BitConnect\Model;

// Prevent direct script access
if (!defined('ABSPATH')) {
    exit;
}

use BitApps\BitConnect\Config;
use BitApps\BitConnect\Deps\BitApps\WPDatabase\Model;
use BitApps\BitConnect\Deps\BitApps\WPDatabase\Relations;
use BitApps\BitConnect\Enum\ReportStatus;

/**
 * Report Model.
 *
 * One row per (reporter, target), enforced by a unique index rather than by a
 * check-then-insert — two quick clicks would race straight past that.
 *
 * Not foreign-keyed to posts or comments: resolving a report by removing the
 * content is a normal ending, and the report is then the record of why the
 * content went.
 */
class Report extends Model
{
    use Relations;

    protected $prefix = Config::VAR_PREFIX;

    protected $fillable = [
        'target_type',
        'target_id',
        'target_author',
        'reporter_id',
        'reason',
        'details',
        'status',
        'resolved_by',
        'resolved_at',
        'resolution_note',
        // created_at and updated_at are deliberately absent: Model::$timestamps
        // is true, so the query builder appends both on every insert. Listing
        // them here as well made the builder emit each column twice and MySQL
        // rejected the statement outright.
    ];

    protected $table = 'reports';

    protected $casts = [
        'target_id'     => 'integer',
        'target_author' => 'integer',
        'reporter_id'   => 'integer',
        'resolved_by'   => 'integer',
    ];

    /**
     * Relationship: Report belongs to the member who made it.
     */
    public function reporter()
    {
        return $this->belongsTo(User::class, 'reporter_id', 'ID');
    }

    /**
     * Reports still awaiting review for one target.
     */
    public static function pendingFor(string $targetType, int $targetId)
    {
        return static::where('target_type', $targetType)
            ->where('target_id', $targetId)
            ->where('status', ReportStatus::PENDING->value)
            ->get();
    }

    /**
     * How many people have reported this target and are still waiting.
     *
     * The number the auto-hide threshold is compared against. Counts rows, which
     * is the same as counting people because of the unique index.
     */
    public static function pendingCount(string $targetType, int $targetId): int
    {
        return (int) static::where('target_type', $targetType)
            ->where('target_id', $targetId)
            ->where('status', ReportStatus::PENDING->value)
            ->count();
    }

    /**
     * Whether this member already has a report in flight for this target.
     */
    public static function alreadyReported(int $reporterId, string $targetType, int $targetId): bool
    {
        return static::where('reporter_id', $reporterId)
            ->where('target_type', $targetType)
            ->where('target_id', $targetId)
            ->count() > 0;
    }
}
