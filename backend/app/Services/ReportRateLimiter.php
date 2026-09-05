<?php

namespace BitApps\BitConnect\Services;

// Prevent direct script access
if (!defined('ABSPATH')) {
    exit;
}

use BitApps\BitConnect\Deps\BitApps\WPKit\Hooks\Hooks;

/**
 * Transient-based rate limiter for reports.
 *
 * Same shape as VoteRateLimiter, different numbers. Reporting is rarer than
 * voting and costs a moderator's attention rather than a counter, so the limit
 * is much tighter: someone working through a thread flagging every post is
 * either wrong or acting in bad faith, and either way the queue should not fill
 * up before anyone notices.
 *
 * The unique index already stops a member reporting the same item twice. This
 * stops them reporting many different items in a burst.
 *
 * Default limits (both filterable):
 *   - 5 reports per 10-minute window per user
 */
final class ReportRateLimiter
{
    /**
     * Transient key prefix.
     */
    private const KEY_PREFIX = 'bc_rrl_';

    /**
     * Maximum number of reports allowed in the time window.
     *
     * Filter: bit_connect_report_rate_limit_max
     */
    private const DEFAULT_MAX = 5;

    /**
     * Length of the time window in seconds.
     *
     * Filter: bit_connect_report_rate_limit_window
     */
    private const DEFAULT_WINDOW = 600;

    /**
     * Whether the user is within the report rate limit.
     *
     * Does NOT consume a slot — call consume() after a report is actually
     * stored, so a rejected one does not count against them.
     */
    public static function isAllowed(int $userId): bool
    {
        if ($userId <= 0) {
            return false;
        }

        $max = (int) Hooks::applyFilter('bit_connect_report_rate_limit_max', self::DEFAULT_MAX);

        return self::getCount($userId) < $max;
    }

    /**
     * Records a report for the user, consuming one slot.
     *
     * The window belongs to the first report in it, not the last. set_transient()
     * writes a fresh expiry every time it is called, so re-storing the count that
     * way pushed the window out with each report: five reports a minute apart
     * blocked the reporter for fourteen minutes rather than ten, and a steady
     * trickle held it open indefinitely. The expiry is carried in the stored
     * value instead, and only the first report in a window sets it.
     */
    public static function consume(int $userId): void
    {
        if ($userId <= 0) {
            return;
        }

        $window = (int) Hooks::applyFilter('bit_connect_report_rate_limit_window', self::DEFAULT_WINDOW);
        $state = self::getState($userId);

        $expiresAt = $state === null ? time() + $window : (int) $state['expires_at'];
        $count = $state === null ? 0 : (int) $state['count'];

        // The TTL tracks the original expiry so the row still disappears on its
        // own; the window it represents is the one already running.
        $remaining = max(1, $expiresAt - time());

        set_transient(
            self::buildKey($userId),
            ['count' => $count + 1, 'expires_at' => $expiresAt],
            $remaining
        );
    }

    /**
     * When the current window closes, or null when none is open.
     */
    public static function windowEndsAt(int $userId): ?int
    {
        $state = self::getState($userId);

        return $state === null ? null : (int) $state['expires_at'];
    }

    /**
     * Human-readable message for a rate-limited response.
     */
    public static function errorMessage(): string
    {
        return __('You have reported several things just now. Please wait a little before reporting anything else.', 'bit-connect');
    }

    private static function getCount(int $userId): int
    {
        $state = self::getState($userId);

        return $state === null ? 0 : (int) $state['count'];
    }

    /**
     * The stored window, or null when there is none.
     *
     * Reads the bare integer an older build stored as well, so an upgrade in the
     * middle of somebody's window does not hand them a fresh five reports. Such
     * a row keeps its own remaining TTL and is treated as expiring now, which is
     * the reading that cannot overcount.
     *
     * @return null|array{count: int, expires_at: int}
     */
    private static function getState(int $userId): ?array
    {
        $value = get_transient(self::buildKey($userId));

        if ($value === false) {
            return null;
        }

        if (\is_array($value) && isset($value['count'], $value['expires_at'])) {
            return ['count' => (int) $value['count'], 'expires_at' => (int) $value['expires_at']];
        }

        return ['count' => (int) $value, 'expires_at' => time()];
    }

    private static function buildKey(int $userId): string
    {
        return self::KEY_PREFIX . $userId;
    }
}
