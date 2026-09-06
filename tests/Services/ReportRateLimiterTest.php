<?php

namespace BitApps\BitConnect\Tests\Services;

use BitApps\BitConnect\Services\ReportRateLimiter;
use PHPUnit\Framework\TestCase;

/**
 * @internal
 *
 * @coversNothing
 */
class ReportRateLimiterTest extends TestCase
{
    protected function setUp(): void
    {
        $GLOBALS['__wp_transients'] = [];
        $GLOBALS['__wp_filters'] = [];
    }

    public function testGuestUserIsNeverAllowed(): void
    {
        $this->assertFalse(ReportRateLimiter::isAllowed(0));
        $this->assertFalse(ReportRateLimiter::isAllowed(-5));
    }

    public function testFreshUserIsAllowed(): void
    {
        $this->assertTrue(ReportRateLimiter::isAllowed(42));
    }

    public function testConsumeIsNoOpForGuestUsers(): void
    {
        ReportRateLimiter::consume(0);

        $this->assertSame([], $GLOBALS['__wp_transients']);
    }

    public function testConsumeStartsAndIncrementsTheCounter(): void
    {
        ReportRateLimiter::consume(42);
        $this->assertSame(1, $GLOBALS['__wp_transients']['bc_rrl_42']['count']);

        ReportRateLimiter::consume(42);
        $this->assertSame(2, $GLOBALS['__wp_transients']['bc_rrl_42']['count']);
    }

    public function testUserIsBlockedOnceTheLimitIsReached(): void
    {
        // Default limit is 5.
        for ($i = 0; $i < 5; ++$i) {
            ReportRateLimiter::consume(42);
        }

        $this->assertFalse(ReportRateLimiter::isAllowed(42));
    }

    public function testTheFifthReportIsAllowedAndTheSixthIsNot(): void
    {
        for ($i = 0; $i < 4; ++$i) {
            ReportRateLimiter::consume(42);
        }

        $this->assertTrue(ReportRateLimiter::isAllowed(42), 'the fifth report should still be allowed');

        ReportRateLimiter::consume(42);

        $this->assertFalse(ReportRateLimiter::isAllowed(42));
    }

    /**
     * The regression this class was rewritten for.
     *
     * consume() used to re-store the count with a full fresh TTL, so every
     * report pushed the window out: five reports a minute apart blocked the
     * reporter for fourteen minutes instead of ten, and a steady trickle held
     * the block open with no end.
     */
    public function testTheWindowBelongsToTheFirstReportNotTheLast(): void
    {
        ReportRateLimiter::consume(42);
        $opened = ReportRateLimiter::windowEndsAt(42);

        ReportRateLimiter::consume(42);
        ReportRateLimiter::consume(42);

        $this->assertSame($opened, ReportRateLimiter::windowEndsAt(42));
    }

    public function testWindowEndsAboutOneWindowFromTheFirstReport(): void
    {
        $before = time();
        ReportRateLimiter::consume(42);

        $endsAt = (int) ReportRateLimiter::windowEndsAt(42);

        // Default window is 600s. Bounded rather than exact so a second ticking
        // over mid-test is not a failure.
        $this->assertGreaterThanOrEqual($before + 600, $endsAt);
        $this->assertLessThanOrEqual($before + 601, $endsAt);
    }

    public function testNoWindowIsOpenForSomeoneWhoHasNotReported(): void
    {
        $this->assertNull(ReportRateLimiter::windowEndsAt(42));
    }

    /**
     * An upgrade mid-window must not hand the reporter a fresh five.
     *
     * Older builds stored a bare integer. Treating one as expiring now is the
     * reading that cannot overcount: the next report opens a new window, and
     * the count it carries forward is the one already spent.
     */
    public function testACountStoredByAnOlderBuildIsStillCounted(): void
    {
        $GLOBALS['__wp_transients']['bc_rrl_42'] = 5;

        $this->assertFalse(ReportRateLimiter::isAllowed(42));

        ReportRateLimiter::consume(42);
        $this->assertSame(6, $GLOBALS['__wp_transients']['bc_rrl_42']['count']);
    }

    public function testLimitIsConfigurableViaFilter(): void
    {
        $GLOBALS['__wp_filters']['bit_connect_report_rate_limit_max'] = 2;

        ReportRateLimiter::consume(42);
        $this->assertTrue(ReportRateLimiter::isAllowed(42));

        ReportRateLimiter::consume(42);
        $this->assertFalse(ReportRateLimiter::isAllowed(42));
    }

    public function testWindowIsConfigurableViaFilter(): void
    {
        $GLOBALS['__wp_filters']['bit_connect_report_rate_limit_window'] = 60;

        $before = time();
        ReportRateLimiter::consume(42);

        $this->assertLessThanOrEqual($before + 61, (int) ReportRateLimiter::windowEndsAt(42));
    }

    public function testErrorMessageAsksThemToWait(): void
    {
        $this->assertStringContainsString('wait', ReportRateLimiter::errorMessage());
    }
}
