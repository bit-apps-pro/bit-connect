<?php

namespace BitApps\BitConnect\Services;

// Prevent direct script access
if (!\defined('ABSPATH')) {
    exit;
}

use BitApps\BitConnect\Deps\BitApps\WPKit\Hooks\Hooks;

/**
 * Throttles the forum's unauthenticated credential endpoints.
 *
 * `auth/login`, `auth/signup`, `auth/forgot-password` and the AJAX login all
 * answer before anyone is logged in, so the per-user limiters this plugin
 * already has (VoteRateLimiter, ReportRateLimiter) have nothing to key on. That
 * left the forum with an unthrottled second front door onto wp_signon(): every
 * login-protection plugin that guards wp-login.php still sees these attempts
 * through the `authenticate` filter, but nothing bounds how many arrive, and
 * nothing at all bounds signup or password-reset mail.
 *
 * Two buckets per action, both of which must have room:
 *
 *  - **per identifier** — the username or email being tried. This is what stops
 *    a password being guessed against one account, and it is deliberately the
 *    tighter of the two.
 *  - **per address** — everything from one caller. This is what stops a list of
 *    accounts being tried one attempt each, which the identifier bucket alone
 *    would never notice.
 *
 * Login consumes only on failure, so somebody who signs in correctly is never
 * penalised for it. Signup and password reset consume on every attempt: both
 * send mail or create records, and the cost is in the attempt rather than in
 * whether it succeeded.
 */
final class AuthRateLimiter
{
    public const LOGIN = 'login';

    public const SIGNUP = 'signup';

    public const PASSWORD_RESET = 'password_reset';

    /**
     * Transient key prefix. Short by necessity — an option name is capped at
     * 191 characters and the identifier is hashed into this.
     */
    private const KEY_PREFIX = 'bc_arl_';

    /**
     * Attempts allowed per window: [per identifier, per address, window seconds].
     *
     * Login is the tightest. Five wrong passwords for one account in a quarter
     * of an hour is already well past a person mistyping, while twenty from one
     * address leaves room for an office behind a single NAT address.
     *
     * Signup and password reset are hourly: both end in an email, and the
     * failure they guard against is a mailbox being flooded rather than a
     * secret being guessed.
     *
     * @var array<string, array{0: int, 1: int, 2: int}>
     */
    private const LIMITS = [
        self::LOGIN          => [5, 20, 900],
        self::SIGNUP         => [3, 10, 3600],
        self::PASSWORD_RESET => [3, 10, 3600],
    ];

    /**
     * Whether another attempt is allowed.
     *
     * Does not consume anything — call consume() once the attempt has been
     * made, so a request rejected for some other reason costs the caller
     * nothing.
     *
     * @param string $action     one of the class constants
     * @param string $identifier the username or email being tried; may be blank
     */
    public static function isAllowed(string $action, string $identifier = ''): bool
    {
        [$perIdentifier, $perAddress] = self::limits($action);

        if ($identifier !== '' && self::count($action, 'id', $identifier) >= $perIdentifier) {
            return false;
        }

        return self::count($action, 'ip', self::address()) < $perAddress;
    }

    /**
     * Record one attempt against both buckets.
     */
    public static function consume(string $action, string $identifier = ''): void
    {
        [, , $window] = self::limits($action);

        if ($identifier !== '') {
            self::increment($action, 'id', $identifier, $window);
        }

        self::increment($action, 'ip', self::address(), $window);
    }

    /**
     * Forget an identifier's attempts.
     *
     * Called after a successful sign-in: the address bucket is left alone, so
     * one correct password does not clear the run of wrong ones that came with
     * it, but the person who has just proved who they are starts fresh.
     */
    public static function forget(string $action, string $identifier): void
    {
        if ($identifier !== '') {
            delete_transient(self::key($action, 'id', $identifier));
        }
    }

    /**
     * What to tell a caller who has run out of attempts.
     *
     * Deliberately says nothing about which bucket was hit or how many attempts
     * remain — that is a measuring instrument for anyone probing, and the person
     * who genuinely mistyped their password only needs to know to wait.
     */
    public static function errorMessage(string $action): string
    {
        [, , $window] = self::limits($action);
        $minutes = max(1, (int) round($window / 60));

        if ($action === self::LOGIN) {
            return \sprintf(
                // translators: %d: number of minutes
                _n(
                    'Too many sign-in attempts. Please wait %d minute and try again.',
                    'Too many sign-in attempts. Please wait %d minutes and try again.',
                    $minutes,
                    'bit-connect'
                ),
                $minutes
            );
        }

        return \sprintf(
            // translators: %d: number of minutes
            _n(
                'Too many attempts. Please wait %d minute and try again.',
                'Too many attempts. Please wait %d minutes and try again.',
                $minutes,
                'bit-connect'
            ),
            $minutes
        );
    }

    // -------------------------------------------------------------------------
    // Internals
    // -------------------------------------------------------------------------

    /**
     * The limits in force for one action, after the filter has had its say.
     *
     * @return array{0: int, 1: int, 2: int} [per identifier, per address, window seconds]
     */
    private static function limits(string $action): array
    {
        $limits = self::LIMITS[$action] ?? self::LIMITS[self::LOGIN];

        /**
         * Filter the attempt limits for one auth action.
         *
         * A site behind a shared address may need a larger per-address bucket;
         * one under attack may want a smaller one. Clamped to at least 1 so a
         * filter cannot lock everybody out permanently by answering 0.
         *
         * @param array{0:int,1:int,2:int} $limits [per identifier, per address, window seconds]
         * @param string                   $action the action being limited
         */
        $limits = (array) Hooks::applyFilter(
            'bit_connect_auth_rate_limits',
            $limits,
            $action
        );

        return [
            max(1, (int) ($limits[0] ?? 5)),
            max(1, (int) ($limits[1] ?? 20)),
            max(1, (int) ($limits[2] ?? 900)),
        ];
    }

    private static function count(string $action, string $bucket, string $value): int
    {
        if ($value === '') {
            return 0;
        }

        $stored = get_transient(self::key($action, $bucket, $value));

        return $stored === false ? 0 : (int) $stored;
    }

    private static function increment(string $action, string $bucket, string $value, int $window): void
    {
        if ($value === '') {
            return;
        }

        $key = self::key($action, $bucket, $value);
        $count = self::count($action, $bucket, $value);

        // Re-setting with the full window on every attempt is deliberate: it
        // makes the limit a cooling-off period rather than a fixed slice of
        // clock time somebody can wait out and then burst against again.
        set_transient($key, $count + 1, $window);
    }

    /**
     * Transient key. The identifier is hashed rather than stored: these become
     * option names, and an email address in a row of wp_options is a disclosure
     * that outlives the fifteen minutes it was needed for.
     */
    private static function key(string $action, string $bucket, string $value): string
    {
        return self::KEY_PREFIX . $action . '_' . $bucket . '_' . md5(strtolower($value));
    }

    /**
     * The caller's address.
     *
     * REMOTE_ADDR only. WPKit's IpTool::ip() prefers X-Forwarded-For and the
     * other forwarding headers, which is right for logging and wrong here: a
     * caller sets those themselves, so a limiter keyed on them is bypassed by
     * varying a header. REMOTE_ADDR is the one value the client cannot choose.
     *
     * Sites genuinely behind a proxy — where REMOTE_ADDR is the load balancer
     * and every visitor shares it — can name a header through the filter below.
     * It is off by default because trusting a forwarded header on a site that
     * is *not* behind a proxy turns this limiter off entirely.
     */
    private static function address(): string
    {
        $remote = isset($_SERVER['REMOTE_ADDR'])
            ? sanitize_text_field(wp_unslash($_SERVER['REMOTE_ADDR']))
            : '';

        /**
         * Filter the server variable the limiter reads the client address from.
         *
         * Return something like 'HTTP_X_FORWARDED_FOR' only when a proxy you
         * control is guaranteed to overwrite it on every request.
         *
         * @param string $key server variable name, or '' for REMOTE_ADDR
         */
        $header = (string) Hooks::applyFilter('bit_connect_auth_rate_limit_ip_header', '');

        if ($header !== '' && isset($_SERVER[$header])) {
            $forwarded = sanitize_text_field(wp_unslash($_SERVER[$header]));
            // A forwarding header is a list; the client's own address is first.
            $first = trim(explode(',', $forwarded)[0]);

            if (filter_var($first, FILTER_VALIDATE_IP) !== false) {
                return $first;
            }
        }

        return filter_var($remote, FILTER_VALIDATE_IP) === false ? '' : $remote;
    }
}
