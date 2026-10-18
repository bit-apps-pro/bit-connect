<?php

namespace BitApps\BitConnect\Tests\Http;

use BitApps\BitConnect\Config;
use BitApps\BitConnect\Enum\GeneralSettings;
use BitApps\BitConnect\Http\Requests\UpdateGeneralSettingsRequest;
use PHPUnit\Framework\TestCase;

/**
 * The Following link in the portal sidebar: off unless an admin switched it on.
 *
 * @internal
 *
 * @coversNothing
 */
final class GeneralSettingsSidebarFollowingTest extends TestCase
{
    protected function setUp(): void
    {
        $GLOBALS['__wp_options'] = [];
    }

    public function testStaysOffForAnInstallThatNeverSawTheSetting(): void
    {
        $this->assertFalse(GeneralSettings::sidebarFollowing(['communityTitle' => 'Acme Community']));
        $this->assertFalse(GeneralSettings::sidebarFollowing(false));
        $this->assertFalse(GeneralSettings::sidebarFollowing(null));
    }

    public function testReadsTheStoredSwitch(): void
    {
        $this->assertTrue(GeneralSettings::sidebarFollowing(['sidebarFollowing' => true]));
        $this->assertFalse(GeneralSettings::sidebarFollowing(['sidebarFollowing' => false]));
    }

    public function testStoresThePostedSwitch(): void
    {
        $this->assertTrue($this->update(['sidebarFollowing' => true])['sidebarFollowing']);
        $this->assertTrue($this->update(['sidebarFollowing' => '1'])['sidebarFollowing']);
        $this->assertFalse($this->update(['sidebarFollowing' => false])['sidebarFollowing']);
    }

    /**
     * The onboarding form posts only the branding fields.
     */
    public function testAPayloadWithoutTheSwitchLeavesItAlone(): void
    {
        $GLOBALS['__wp_options'][Config::withPrefix(GeneralSettings::OPTION_NAME->value)] = [
            'sidebarFollowing' => true,
        ];

        $this->assertTrue($this->update(['communityTitle' => 'Acme Community'])['sidebarFollowing']);
    }

    /**
     * @param array<string, mixed> $input
     *
     * @return array<string, mixed>
     */
    private function update(array $input): array
    {
        $request = new UpdateGeneralSettingsRequest();

        foreach ($input as $key => $value) {
            $request->{$key} = $value;
        }

        return $request->toSettingsData();
    }
}
