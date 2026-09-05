<?php

namespace BitApps\BitConnect\Model;

/**
 * Test double for the ActivityLog model.
 *
 * Loaded from bootstrap.php before the Composer autoloader, the same mechanism
 * the Follow double uses: PHP only consults an autoloader for a class that is
 * not already defined, so this wins.
 *
 * It exists so the "log only what someone did to content they did not write"
 * rule can be tested at all. That rule is enforced at every call site, and a
 * mistake in it is invisible from the outside — a missing row looks like a quiet
 * week, and a spurious one buries the handful of rows that matter.
 *
 * Inserted rows land in $GLOBALS['__bc_activity_log'], newest last.
 */
class ActivityLog
{
    /**
     * @param array<string, mixed> $attributes
     */
    public static function insert(array $attributes): bool
    {
        $GLOBALS['__bc_activity_log'][] = $attributes;

        return true;
    }
}
