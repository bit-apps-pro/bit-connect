<?php

namespace BitApps\BitConnect\Tests\Http;

use BitApps\BitConnect\Enum\GeneralSettings;
use PHPUnit\Framework\TestCase;

/**
 * The switches over the portal's topic-list filters.
 *
 * Every control is on until an admin turns it off. The topic-type chips rode
 * Sort's switch before they had their own, so a site that never saved theirs
 * keeps the chips exactly where Sort left them.
 *
 * @internal
 *
 * @coversNothing
 */
final class GeneralSettingsPortalFiltersTest extends TestCase
{
    public function testEverythingIsOnForAnInstallThatNeverSawTheSetting(): void
    {
        $this->assertSame(
            ['sort' => true, 'tags' => true, 'types' => true],
            GeneralSettings::portalFilters(['communityTitle' => 'Acme'])
        );
    }

    public function testTheTypeChipsFollowSortUntilSavedOnTheirOwn(): void
    {
        $this->assertFalse(GeneralSettings::portalFilters(['portalFilters' => ['sort' => false]])['types']);
        $this->assertTrue(GeneralSettings::portalFilters(['portalFilters' => ['sort' => true]])['types']);
    }

    public function testTheTypeSwitchOnceSavedIsIndependentOfSort(): void
    {
        $this->assertSame(
            ['sort' => false, 'tags' => true, 'types' => true],
            GeneralSettings::portalFilters(['portalFilters' => ['sort' => false, 'types' => true]])
        );
        $this->assertSame(
            ['sort' => true, 'tags' => true, 'types' => false],
            GeneralSettings::portalFilters(['portalFilters' => ['sort' => true, 'types' => false]])
        );
    }
}
