<?php

namespace BitApps\BitConnect\Tests\Services;

use BitApps\BitConnect\Services\AuthRateLimiter;
use PHPUnit\Framework\TestCase;

/**
 * The throttle on the forum's credential endpoints.
 *
 * These endpoints answer before anyone is logged in, so they are the one place
 * the plugin's per-user limiters cannot reach. The cases that matter are the
 * ones where a naive limiter leaks: a correct password should not be spent
 * against the limit, and a caller should not be able to reset their own count
 * by varying a header they control.
 *
 * @internal
 *
 * @coversNothing
 */
final class AuthRateLimiterTest extends TestCase
{
    protected function setUp(): void
    {
        $GLOBALS['__wp_transients'] = [];
        $GLOBALS['__wp_filters'] = [];
        $_SERVER['REMOTE_ADDR'] = '203.0.113.10';
    }

    protected function tearDown(): void
    {
        $GLOBALS['__wp_transients'] = [];
        $GLOBALS['__wp_filters'] = [];

        unset($_SERVER['REMOTE_ADDR'], $_SERVER['HTTP_X_FORWARDED_FOR']);
    }

    // -----------------------------------------------------------------------
    // Guessing one account's password
    // -----------------------------------------------------------------------

    public function testTheFirstAttemptIsAllowed(): void
    {
        $this->assertTrue(AuthRateLimiter::isAllowed(AuthRateLimiter::LOGIN, 'ann'));
    }

    public function testAccountIsThrottledAfterFiveWrongPasswords(): void
    {
        for ($i = 0; $i < 5; ++$i) {
            $this->assertTrue(
                AuthRateLimiter::isAllowed(AuthRateLimiter::LOGIN, 'ann'),
                "Attempt {$i} should still be allowed."
            );
            AuthRateLimiter::consume(AuthRateLimiter::LOGIN, 'ann');
        }

        $this->assertFalse(AuthRateLimiter::isAllowed(AuthRateLimiter::LOGIN, 'ann'));
    }

    public function testAnotherAccountIsUnaffected(): void
    {
        for ($i = 0; $i < 5; ++$i) {
            AuthRateLimiter::consume(AuthRateLimiter::LOGIN, 'ann');
        }

        // Same address, different account: the address bucket allows 20, so this
        // must still get through. Locking every account on a shared address out
        // because one was targeted is a denial of service in itself.
        $this->assertTrue(AuthRateLimiter::isAllowed(AuthRateLimiter::LOGIN, 'bob'));
    }

    public function testSigningInSuccessfullyClearsTheAccountsAttempts(): void
    {
        for ($i = 0; $i < 4; ++$i) {
            AuthRateLimiter::consume(AuthRateLimiter::LOGIN, 'ann');
        }

        AuthRateLimiter::forget(AuthRateLimiter::LOGIN, 'ann');

        $this->assertTrue(AuthRateLimiter::isAllowed(AuthRateLimiter::LOGIN, 'ann'));
    }

    // -----------------------------------------------------------------------
    // Working through a list of accounts
    // -----------------------------------------------------------------------

    public function testOneAddressIsThrottledAcrossDifferentAccounts(): void
    {
        // One attempt each against twenty accounts never trips the per-account
        // bucket. The address bucket is the only thing that sees this.
        for ($i = 0; $i < 20; ++$i) {
            AuthRateLimiter::consume(AuthRateLimiter::LOGIN, "member{$i}");
        }

        $this->assertFalse(
            AuthRateLimiter::isAllowed(AuthRateLimiter::LOGIN, 'someone-new'),
            'A caller spreading attempts across accounts must still be stopped.'
        );
    }

    public function testADifferentAddressStartsFresh(): void
    {
        for ($i = 0; $i < 20; ++$i) {
            AuthRateLimiter::consume(AuthRateLimiter::LOGIN, "member{$i}");
        }

        $_SERVER['REMOTE_ADDR'] = '198.51.100.4';

        $this->assertTrue(AuthRateLimiter::isAllowed(AuthRateLimiter::LOGIN, 'ann'));
    }

    // -----------------------------------------------------------------------
    // The bypass a forwarded header would open
    // -----------------------------------------------------------------------

    public function testAForwardedHeaderIsIgnoredByDefault(): void
    {
        for ($i = 0; $i < 20; ++$i) {
            AuthRateLimiter::consume(AuthRateLimiter::LOGIN, "member{$i}");
        }

        // WPKit's IpTool would take this over REMOTE_ADDR, which would let a
        // caller reset their own bucket on every request.
        $_SERVER['HTTP_X_FORWARDED_FOR'] = '198.51.100.99';

        $this->assertFalse(
            AuthRateLimiter::isAllowed(AuthRateLimiter::LOGIN, 'ann'),
            'A client-supplied header must not be able to clear the limit.'
        );
    }

    public function testASiteBehindAProxyCanOptIntoTheHeader(): void
    {
        $GLOBALS['__wp_filters']['bit_connect_auth_rate_limit_ip_header'] = 'HTTP_X_FORWARDED_FOR';
        $_SERVER['HTTP_X_FORWARDED_FOR'] = '198.51.100.99';

        for ($i = 0; $i < 20; ++$i) {
            AuthRateLimiter::consume(AuthRateLimiter::LOGIN, "member{$i}");
        }

        $this->assertFalse(AuthRateLimiter::isAllowed(AuthRateLimiter::LOGIN, 'ann'));

        // A second visitor behind the same proxy, distinguished only by the
        // forwarded address, is counted separately.
        $_SERVER['HTTP_X_FORWARDED_FOR'] = '198.51.100.7';

        $this->assertTrue(AuthRateLimiter::isAllowed(AuthRateLimiter::LOGIN, 'ann'));
    }

    // -----------------------------------------------------------------------
    // The mail-sending actions
    // -----------------------------------------------------------------------

    public function testPasswordResetIsThrottledAfterThreeRequests(): void
    {
        for ($i = 0; $i < 3; ++$i) {
            $this->assertTrue(AuthRateLimiter::isAllowed(AuthRateLimiter::PASSWORD_RESET, 'ann@example.com'));
            AuthRateLimiter::consume(AuthRateLimiter::PASSWORD_RESET, 'ann@example.com');
        }

        $this->assertFalse(AuthRateLimiter::isAllowed(AuthRateLimiter::PASSWORD_RESET, 'ann@example.com'));
    }

    public function testSignupAndPasswordResetDoNotShareABucket(): void
    {
        for ($i = 0; $i < 3; ++$i) {
            AuthRateLimiter::consume(AuthRateLimiter::SIGNUP, 'ann@example.com');
        }

        $this->assertFalse(AuthRateLimiter::isAllowed(AuthRateLimiter::SIGNUP, 'ann@example.com'));
        $this->assertTrue(AuthRateLimiter::isAllowed(AuthRateLimiter::PASSWORD_RESET, 'ann@example.com'));
    }

    public function testTheIdentifierIsNotStoredInTheClear(): void
    {
        AuthRateLimiter::consume(AuthRateLimiter::PASSWORD_RESET, 'ann@example.com');

        foreach (array_keys($GLOBALS['__wp_transients']) as $key) {
            $this->assertStringNotContainsString(
                'ann@example.com',
                $key,
                'Transient keys become option names — an address must not sit in one.'
            );
        }
    }

    // -----------------------------------------------------------------------
    // Configuration
    // -----------------------------------------------------------------------

    public function testAFilterCanRaiseTheLimits(): void
    {
        $GLOBALS['__wp_filters']['bit_connect_auth_rate_limits'] = [50, 200, 900];

        for ($i = 0; $i < 20; ++$i) {
            AuthRateLimiter::consume(AuthRateLimiter::LOGIN, 'ann');
        }

        $this->assertTrue(AuthRateLimiter::isAllowed(AuthRateLimiter::LOGIN, 'ann'));
    }

    public function testAFilterCannotLockEverybodyOut(): void
    {
        // Zero would mean "no attempt is ever allowed", which is a way to break
        // sign-in for the whole site by returning the wrong shape.
        $GLOBALS['__wp_filters']['bit_connect_auth_rate_limits'] = [0, 0, 0];

        $this->assertTrue(AuthRateLimiter::isAllowed(AuthRateLimiter::LOGIN, 'ann'));
    }

    public function testTheMessageDoesNotSayHowManyAttemptsRemain(): void
    {
        $message = AuthRateLimiter::errorMessage(AuthRateLimiter::LOGIN);

        $this->assertStringContainsString('15', $message, 'It should say how long to wait.');
        $this->assertStringNotContainsString('5', str_replace('15', '', $message));
    }
}
