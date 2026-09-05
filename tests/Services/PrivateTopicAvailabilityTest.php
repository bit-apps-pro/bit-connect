<?php

namespace BitApps\BitConnect\Tests\Services;

use BitApps\BitConnect\Services\PermissionService;
use BitApps\BitConnectPro\Utils\PluginCommonConfig;
use PHPUnit\Framework\TestCase;

/**
 * Whether the forum will accept a private topic.
 *
 * Two independent gates, and the interesting cases are the ones where they
 * disagree. The admin setting alone must not open it — private topics are a pro
 * feature, and a free site with the option somehow set to true (an imported
 * option blob, a licence that lapsed, a hand-edited row) has to stay closed.
 * A licence alone must not open it either, or every pro site would get private
 * topics whether or not it asked for them.
 *
 * @internal
 *
 * @coversNothing
 */
final class PrivateTopicAvailabilityTest extends TestCase
{
    protected function setUp(): void
    {
        $GLOBALS['__wp_options'] = [];
        $GLOBALS['__wp_filters'] = [];

        // The licence option's name is built from this prefix, which the pro
        // plugin sets at boot. Tests run without that boot, so set it here.
        PluginCommonConfig::setProPluginPrefix('bit_connect_pro_');
    }

    protected function tearDown(): void
    {
        $GLOBALS['__wp_options'] = [];
    }

    public function testAForumThatHasNotAskedForThemDoesNotGetThem(): void
    {
        $this->licence(true);

        $this->assertFalse(PermissionService::canUsePrivateTopics());
    }

    public function testTheSettingAloneDoesNotUnlockAPaidFeature(): void
    {
        $this->setting(true);

        $this->assertFalse(PermissionService::canUsePrivateTopics());
    }

    public function testBothGatesOpenMeansPrivateTopicsAreAvailable(): void
    {
        $this->setting(true);
        $this->licence(true);

        $this->assertTrue(PermissionService::canUsePrivateTopics());
    }

    public function testALapsedLicenceClosesItAgain(): void
    {
        $this->setting(true);
        $this->licence(false);

        $this->assertFalse(PermissionService::canUsePrivateTopics());
    }

    /**
     * A malformed option must read as off rather than as an error: the value
     * comes out of the database and can be anything by the time it comes back.
     */
    public function testAnUnreadableSettingReadsAsOff(): void
    {
        $this->licence(true);
        $GLOBALS['__wp_options']['bit_connect_admin_settings'] = 'not-an-array';

        $this->assertFalse(PermissionService::canUsePrivateTopics());
    }

    private function setting(bool $enabled): void
    {
        $GLOBALS['__wp_options']['bit_connect_admin_settings'] = [
            'topicAccess' => ['privateTopic' => $enabled],
        ];
    }

    private function licence(bool $valid): void
    {
        // The add-on registers its listeners only while licensed.
        $valid ? bc_test_install_pro_addon(['private_topics']) : bc_test_uninstall_pro_addon();

        $GLOBALS['__wp_options']['bit_connect_pro_license_data'] = $valid
            ? ['key' => 'test-key', 'status' => 'success']
            : ['key' => 'test-key', 'status' => 'expired'];
    }
}
