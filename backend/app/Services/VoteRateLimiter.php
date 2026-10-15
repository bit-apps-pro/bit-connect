<?php

namespace BitApps\BitConnect\Services;

// Prevent direct script access
if (!defined('ABSPATH')) {
    exit;
}

use BitApps\BitConnect\Deps\BitApps\WPKit\Hooks\Hooks;

/**
 * Transient-based rate limiter for forum votes.
 *
 * Counts a member's votes until they go a whole window without one, and
 * refuses past the threshold. Stored in wp_options via transients — no extra
 * tables required.
 *
 * Default limits (configurable via filters):
 *   - 30 votes per 60-second window per user
 */
final class VoteRateLimiter
{
    /**
     * Transient key prefix.
     */
    private const KEY_PREFIX = 'bit_connect_vrl_';

    /**
     * Maximum number of votes allowed in the time window.
     *
     * Filter: bit_connect_vote_rate_limit_max
     */
    private const DEFAULT_MAX = 30;

    /**
     * Length of the time window in seconds.
     *
     * Filter: bit_connect_vote_rate_limit_window
     */
    private const DEFAULT_WINDOW = 60;

    /**
     * Checks whether the user is within the vote rate limit.
     * Returns true when the action is allowed, false when rate-limited.
     *
     * Does NOT consume a rate-limit slot — call consume() after a successful vote.
     */
    public static function isAllowed(int $userId): bool
    {
        if ($userId <= 0) {
            return false;
        }

        $max = (int) Hooks::applyFilter('bit_connect_vote_rate_limit_max', self::DEFAULT_MAX);
        $count = self::getCount($userId);

        return $count < $max;
    }

    /**
     * Records a vote action for the user, consuming one rate-limit slot, and
     * restarts the window.
     */
    public static function consume(int $userId): void
    {
        if ($userId <= 0) {
            return;
        }

        $window = (int) Hooks::applyFilter('bit_connect_vote_rate_limit_window', self::DEFAULT_WINDOW);
        $key = self::buildKey($userId);
        $count = self::getCount($userId);

        // Every counted vote restarts the window, so the count clears once the
        // member has gone a whole window without voting. That is what the
        // refusal promises — "wait 60 seconds" — and a refused vote is never
        // counted, so waiting is always enough.
        set_transient($key, $count + 1, $window);
    }

    /**
     * Returns a human-readable error message for rate-limited responses.
     */
    public static function errorMessage(): string
    {
        $window = (int) Hooks::applyFilter('bit_connect_vote_rate_limit_window', self::DEFAULT_WINDOW);

        return \sprintf(
            // translators: %d: number of seconds
            __('You are voting too quickly. Please wait %d seconds before voting again.', 'bit-connect'),
            $window
        );
    }

    // -------------------------------------------------------------------------
    // Internals
    // -------------------------------------------------------------------------

    private static function getCount(int $userId): int
    {
        $value = get_transient(self::buildKey($userId));

        return $value === false ? 0 : (int) $value;
    }

    private static function buildKey(int $userId): string
    {
        return self::KEY_PREFIX . $userId;
    }
}
