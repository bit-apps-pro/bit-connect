<?php

namespace BitApps\BitConnect\Tests\Services;

use BitApps\BitConnect\Services\ReportService;
use PHPUnit\Framework\TestCase;

/**
 * What this forum accepts reports about.
 *
 * Only what this plugin can act on. There is no threshold test beside this:
 * the plugin holds no count that hides content, because it never hides
 * anything by itself — see ExtensionPoints::autoHideOnReports() — so there is
 * no number here to pin.
 *
 * @internal
 *
 * @coversNothing
 */
class ReportTargetTypeTest extends TestCase
{
    public function testOnlyPostsAndCommentsCanBeReported(): void
    {
        $this->assertTrue(ReportService::isValidTargetType('post'));
        $this->assertTrue(ReportService::isValidTargetType('comment'));

        foreach (['user', 'attachment', 'widget', '', 'POST'] as $type) {
            $this->assertFalse(
                ReportService::isValidTargetType($type),
                $type . ' is not something this forum accepts reports about'
            );
        }
    }
}
