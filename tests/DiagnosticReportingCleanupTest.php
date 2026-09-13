<?php

namespace BitApps\BitConnect\Tests;

use BitApps\BitConnect\Plugin;
use PHPUnit\Framework\TestCase;

/**
 * What an upgrade from a build that still reported diagnostics leaves behind,
 * and that a site which never had it is not touched.
 *
 * The vendored reporting package is gone. A site that had opted in still holds
 * its consent options and a weekly cron event that now has no listener; both
 * should go on the next admin load, and a site with neither should not pay for
 * a delete it does not need.
 *
 * @internal
 *
 * @coversNothing
 */
final class DiagnosticReportingCleanupTest extends TestCase
{
    protected function setUp(): void
    {
        $GLOBALS['__wp_options'] = [];
        $GLOBALS['__wp_cleared_hooks'] = [];
    }

    protected function tearDown(): void
    {
        $GLOBALS['__wp_options'] = [];
        $GLOBALS['__wp_cleared_hooks'] = [];
    }

    public function testAnOptedInSiteLosesItsConsentAndItsSchedule(): void
    {
        $GLOBALS['__wp_options'] = [
            'bit_connect_allow_tracking'           => true,
            'bit_connect_tracking_notice_dismissed' => true,
            'bit_connect_tracking_last_sended_at'   => 1_700_000_000,
            'bit_connect_portal_page'               => 'community',
        ];

        Plugin::forgetDiagnosticReporting();

        $this->assertSame(['bit_connect_portal_page' => 'community'], $GLOBALS['__wp_options']);
        $this->assertSame(['bit_connect_send_tracking_event'], $GLOBALS['__wp_cleared_hooks']);
    }

    public function testADeclinedSiteIsCleanedToo(): void
    {
        $GLOBALS['__wp_options'] = [
            'bit_connect_allow_tracking'           => false,
            'bit_connect_tracking_notice_dismissed' => true,
        ];

        Plugin::forgetDiagnosticReporting();

        $this->assertSame([], $GLOBALS['__wp_options']);
    }

    public function testASiteThatNeverReportedIsLeftAlone(): void
    {
        $GLOBALS['__wp_options'] = ['bit_connect_portal_page' => 'community'];

        Plugin::forgetDiagnosticReporting();

        $this->assertSame(['bit_connect_portal_page' => 'community'], $GLOBALS['__wp_options']);
        $this->assertSame([], $GLOBALS['__wp_cleared_hooks'], 'No schedule to clear, so no call.');
    }
}
