<?php

namespace BitApps\BitConnect\Tests\Services;

use BitApps\BitConnect\Enum\NotificationSettings;
use BitApps\BitConnectPro\Utils\PluginCommonConfig;
use PHPUnit\Framework\TestCase;

/**
 * What an unlicensed forum gets from the settings it is not entitled to set.
 *
 * Sender identity, digest cadence and the four email template lines are pro.
 * The gate lives in the normalisers rather than in the admin screen, and that
 * is the point of these tests: the cron and every dispatch read these values
 * unsupervised, so a check that only ran in the UI would be no check at all —
 * a stale tab, a direct POST, or a licence that lapsed long after the option
 * was written would each sail straight past it.
 *
 * The stored value is never destroyed, only ignored. A forum that renews gets
 * its sender and wording back rather than having to type them again, which is
 * why every case here asserts against a settings array that *does* hold the
 * custom values.
 *
 * @internal
 *
 * @coversNothing
 */
final class NotificationSettingsProGateTest extends TestCase
{
    /** A settings blob with every pro field set to something recognisable. */
    private const CUSTOMISED = [
        'fromName'         => 'The Forum Team',
        'fromEmail'        => 'forum@example.com',
        'defaultFrequency' => NotificationSettings::FREQUENCY_WEEKLY,
        'digestHour'       => 6,
        'mailGreeting'     => 'Hi {name}!',
        'mailIntro'        => 'Some things happened:',
        'mailDigestIntro'  => 'Your week:',
        'mailFooter'       => 'Manage your email here:',
    ];

    protected function setUp(): void
    {
        $GLOBALS['__wp_bloginfo'] = ['name' => 'Bit Flows Forum'];
        $GLOBALS['__wp_home_url'] = 'https://forum.example.com';
        $GLOBALS['__wp_options'] = [];
        $GLOBALS['__wp_filters'] = [];

        PluginCommonConfig::setProPluginPrefix('bit_connect_pro_');
    }

    protected function tearDown(): void
    {
        $GLOBALS['__wp_options'] = [];
    }

    public function testAnUnlicensedForumSendsAsTheSiteWhateverItStored(): void
    {
        $this->licence(false);

        $this->assertSame('Bit Flows Forum', NotificationSettings::fromName(self::CUSTOMISED));
        $this->assertSame('wordpress@forum.example.com', NotificationSettings::fromEmail(self::CUSTOMISED));
    }

    public function testALapsedLicenceStopsDigestsGoingOut(): void
    {
        $this->licence(false);

        $this->assertSame(
            NotificationSettings::FREQUENCY_INSTANT,
            NotificationSettings::defaultFrequency(self::CUSTOMISED)
        );
    }

    public function testAnUnlicensedForumUsesTheBuiltInWording(): void
    {
        $this->licence(false);

        $this->assertSame('Hello {name},', NotificationSettings::mailGreeting(self::CUSTOMISED));
        $this->assertSame('Here is what happened:', NotificationSettings::mailIntro(self::CUSTOMISED));
        $this->assertNotSame('Your week:', NotificationSettings::mailDigestIntro(self::CUSTOMISED));
        $this->assertNotSame('Manage your email here:', NotificationSettings::mailFooter(self::CUSTOMISED));
    }

    public function testALicenceHandsEveryOneOfThemBack(): void
    {
        $this->licence(true);

        $this->assertSame('The Forum Team', NotificationSettings::fromName(self::CUSTOMISED));
        $this->assertSame('forum@example.com', NotificationSettings::fromEmail(self::CUSTOMISED));
        $this->assertSame(
            NotificationSettings::FREQUENCY_WEEKLY,
            NotificationSettings::defaultFrequency(self::CUSTOMISED)
        );
        $this->assertSame(6, NotificationSettings::digestHour(self::CUSTOMISED));
        $this->assertSame('Hi {name}!', NotificationSettings::mailGreeting(self::CUSTOMISED));
        $this->assertSame('Manage your email here:', NotificationSettings::mailFooter(self::CUSTOMISED));
    }

    /**
     * The screen reads its values from normalize(), so the gate has to reach it
     * too — otherwise an unlicensed admin is shown a sender the forum will not
     * actually use.
     */
    public function testTheAdminScreenIsShownTheValuesThatWillReallyBeUsed(): void
    {
        $this->licence(false);

        $normalised = NotificationSettings::normalize(self::CUSTOMISED);

        $this->assertSame('Bit Flows Forum', $normalised['fromName']);
        $this->assertSame(NotificationSettings::FREQUENCY_INSTANT, $normalised['defaultFrequency']);
        $this->assertSame('Hello {name},', $normalised['mailGreeting']);
    }

    /**
     * Free settings sit in the same option and must be untouched by the gate.
     */
    public function testTheFreeSettingsAreUnaffected(): void
    {
        $this->licence(false);

        $settings = array_merge(self::CUSTOMISED, ['enabled' => true, 'retentionDays' => 120]);

        $this->assertTrue(NotificationSettings::isEnabled($settings));
        $this->assertSame(120, NotificationSettings::retentionDays($settings));
    }

    private function licence(bool $valid): void
    {
        // The add-on registers its listeners only while licensed.
        $valid ? bc_test_install_pro_addon(['notification_delivery', 'notification_wording']) : bc_test_uninstall_pro_addon();

        $GLOBALS['__wp_options']['bit_connect_pro_license_data'] = [
            'key'    => 'test-key',
            'status' => $valid ? 'success' : 'expired',
        ];
    }
}
