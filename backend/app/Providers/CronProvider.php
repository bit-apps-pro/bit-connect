<?php

namespace BitApps\BitConnect\Providers;

// Prevent direct script access
if (!defined('ABSPATH')) {
    exit;
}

use BitApps\BitConnect\Config;
use BitApps\BitConnect\Deps\BitApps\WPKit\Hooks\Hooks;
use BitApps\BitConnect\Services\NotificationDigest;

/**
 * The plugin's scheduled work.
 *
 * The first cron this plugin has had. Two jobs, deliberately separate: mail
 * going out, and old rows being cleared away. A forum that has switched email
 * off entirely still needs its notifications table pruned, so folding the
 * second into the first would quietly tie housekeeping to a feature nobody was
 * using.
 *
 * Both hooks are registered on every request and scheduled only if absent, which
 * is what makes this safe to call from `init` — an event scheduled once stays
 * scheduled, and re-registering the callback is what makes it runnable when WP
 * fires it. Registering without scheduling would give a job nothing to wake it;
 * scheduling without registering would give WordPress an event with no listener,
 * which it retries and then abandons.
 */
final class CronProvider
{
    public const DIGEST_HOOK = Config::VAR_PREFIX . 'notification_digest';

    public const CLEANUP_HOOK = Config::VAR_PREFIX . 'notification_cleanup';

    /**
     * Wires the callbacks and makes sure both events exist.
     */
    public static function register(): void
    {
        Hooks::addAction(self::DIGEST_HOOK, [NotificationDigest::class, 'run']);
        Hooks::addAction(self::CLEANUP_HOOK, [NotificationDigest::class, 'cleanup']);

        self::schedule();
    }

    /**
     * Schedules whichever events are missing.
     *
     * Hourly for the digest, not daily: members choose a cadence and admins
     * choose an hour, so the job has to wake often enough to catch whichever
     * hour that turns out to be. Each run is cheap when there is nothing owing —
     * one indexed GROUP BY over `emailed_at IS NULL`.
     */
    public static function schedule(): void
    {
        if (!wp_next_scheduled(self::DIGEST_HOOK)) {
            wp_schedule_event(time() + HOUR_IN_SECONDS, 'hourly', self::DIGEST_HOOK);
        }

        if (!wp_next_scheduled(self::CLEANUP_HOOK)) {
            wp_schedule_event(time() + DAY_IN_SECONDS, 'daily', self::CLEANUP_HOOK);
        }
    }

    /**
     * Removes both events.
     *
     * Called on deactivation. Without it the schedule outlives the plugin:
     * WordPress keeps firing hooks nothing listens to any more, and reactivating
     * later would add a second copy alongside the orphan.
     */
    public static function clear(): void
    {
        wp_clear_scheduled_hook(self::DIGEST_HOOK);
        wp_clear_scheduled_hook(self::CLEANUP_HOOK);
    }
}
