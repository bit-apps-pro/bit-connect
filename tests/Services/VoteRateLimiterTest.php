<?php

namespace BitApps\BitConnect\Tests\Services;

use BitApps\BitConnect\Services\VoteRateLimiter;
use PHPUnit\Framework\TestCase;

class VoteRateLimiterTest extends TestCase
{
    protected function setUp(): void
    {
        $GLOBALS['__wp_transients'] = [];
        $GLOBALS['__wp_filters']    = [];
    }

    public function testGuestUserIsNeverAllowed(): void
    {
        $this->assertFalse(VoteRateLimiter::isAllowed(0));
        $this->assertFalse(VoteRateLimiter::isAllowed(-5));
    }

    public function testFreshUserIsAllowed(): void
    {
        $this->assertTrue(VoteRateLimiter::isAllowed(42));
    }

    public function testConsumeIsNoOpForGuestUsers(): void
    {
        VoteRateLimiter::consume(0);

        $this->assertSame([], $GLOBALS['__wp_transients']);
    }

    public function testConsumeStartsAndIncrementsTheCounter(): void
    {
        VoteRateLimiter::consume(42);
        $this->assertSame(1, $GLOBALS['__wp_transients']['bc_vrl_42']);

        VoteRateLimiter::consume(42);
        $this->assertSame(2, $GLOBALS['__wp_transients']['bc_vrl_42']);
    }

    public function testUserIsBlockedOnceTheLimitIsReached(): void
    {
        // Default limit is 30 — pre-seed the counter at the max.
        $GLOBALS['__wp_transients']['bc_vrl_42'] = 30;

        $this->assertFalse(VoteRateLimiter::isAllowed(42));
    }

    public function testLimitIsConfigurableViaFilter(): void
    {
        $GLOBALS['__wp_filters']['bit_connect_vote_rate_limit_max'] = 2;
        $GLOBALS['__wp_transients']['bc_vrl_42']                    = 2;

        $this->assertFalse(VoteRateLimiter::isAllowed(42));

        $GLOBALS['__wp_transients']['bc_vrl_42'] = 1;
        $this->assertTrue(VoteRateLimiter::isAllowed(42));
    }

    public function testErrorMessageMentionsTheWindow(): void
    {
        $GLOBALS['__wp_filters']['bit_connect_vote_rate_limit_window'] = 60;

        $this->assertStringContainsString('60', VoteRateLimiter::errorMessage());
    }
}
