<?php

namespace BitApps\BitConnect\Tests\Services;

use BitApps\BitConnect\Services\ReportService;
use PHPUnit\Framework\TestCase;

/**
 * How many reports it takes to take somebody's words out of public view.
 *
 * The one number in this feature that decides whether reporting is a request
 * for review or a button that hides content, so every way of setting it is
 * pinned here: the default, the admin setting, the option it used to live in,
 * and the filter.
 *
 * @internal
 *
 * @coversNothing
 */
class ReportAutoHideThresholdTest extends TestCase
{
    protected function setUp(): void
    {
        $GLOBALS['__wp_options'] = [];
        $GLOBALS['__wp_filters'] = [];
    }

    public function testDefaultsToTwoSoOnePersonCannotHideContentAlone(): void
    {
        $this->assertSame(2, ReportService::autoHideThreshold());
        $this->assertSame(2, ReportService::DEFAULT_AUTO_HIDE_THRESHOLD);
    }

    public function testReadsTheAdminSetting(): void
    {
        $this->storeAdminSettings(['autoHideThreshold' => 5]);

        $this->assertSame(5, ReportService::autoHideThreshold());
    }

    public function testAForumThatWantsToActOnTheFirstReportMay(): void
    {
        $this->storeAdminSettings(['autoHideThreshold' => 1]);

        $this->assertSame(1, ReportService::autoHideThreshold());
    }

    /**
     * Zero would mean content hides itself before anybody reports it, since the
     * pending count is compared with >=.
     */
    public function testZeroAndNegativeAreFlooredAtOne(): void
    {
        $this->storeAdminSettings(['autoHideThreshold' => 0]);
        $this->assertSame(1, ReportService::autoHideThreshold());

        $this->storeAdminSettings(['autoHideThreshold' => -3]);
        $this->assertSame(1, ReportService::autoHideThreshold());
    }

    /**
     * Sites that set the standalone option before this moved into settings keep
     * the number they chose, rather than silently changing behaviour on upgrade.
     */
    public function testFallsBackToTheOptionThisUsedToLiveIn(): void
    {
        update_option('bit_connect_report_auto_hide_threshold', 4);

        $this->assertSame(4, ReportService::autoHideThreshold());
    }

    public function testTheAdminSettingWinsOverTheOldOption(): void
    {
        update_option('bit_connect_report_auto_hide_threshold', 4);
        $this->storeAdminSettings(['autoHideThreshold' => 7]);

        $this->assertSame(7, ReportService::autoHideThreshold());
    }

    public function testTheFilterHasTheLastWord(): void
    {
        $this->storeAdminSettings(['autoHideThreshold' => 3]);
        $GLOBALS['__wp_filters']['bit_connect_report_auto_hide_threshold'] = 9;

        $this->assertSame(9, ReportService::autoHideThreshold());
    }

    public function testAdminSettingsWithoutAModerationSectionFallThrough(): void
    {
        update_option('bit_connect_admin_settings', ['topicAccess' => ['comment' => true]]);

        $this->assertSame(2, ReportService::autoHideThreshold());
    }

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

    private function storeAdminSettings(array $moderation): void
    {
        update_option('bit_connect_admin_settings', ['moderation' => $moderation]);
    }
}
