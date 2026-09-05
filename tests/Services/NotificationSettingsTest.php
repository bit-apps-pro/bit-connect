<?php

namespace BitApps\BitConnect\Tests\Services;

use BitApps\BitConnect\Enum\NotificationSettings;
use BitApps\BitConnect\Enum\NotificationTypes;
use BitApps\BitConnectPro\Utils\PluginCommonConfig;
use PHPUnit\Framework\TestCase;

/**
 * The forum-wide notification settings, and the values that must never reach the
 * jobs that read them.
 *
 * Every number here is one a cron job acts on unsupervised, which is why the
 * clamps are pinned rather than trusted to the admin form: a retention of zero
 * deletes a notification the instant it is read, and an hour of 25 is a digest
 * that never goes out at all.
 *
 * @internal
 *
 * @coversNothing
 */
class NotificationSettingsTest extends TestCase
{
    protected function setUp(): void
    {
        $GLOBALS['__wp_bloginfo'] = ['name' => 'Bit Flows Forum'];
        $GLOBALS['__wp_home_url'] = 'https://forum.example.com';

        // Sender identity, digest schedule and email wording only reach these
        // normalisers when the add-on supplies them — see
        // NotificationSettingsProGateTest for what a forum without it gets. The
        // clamps are what is under test here, so the add-on is installed and
        // stays out of the way.
        $GLOBALS['__wp_options'] = [];
        $GLOBALS['__wp_filters'] = [];
        PluginCommonConfig::setProPluginPrefix('bit_connect_pro_');
        $GLOBALS['__wp_options']['bit_connect_pro_license_data'] = [
            'key'    => 'test-key',
            'status' => 'success',
        ];
        bc_test_install_pro_addon(['notification_delivery', 'notification_wording']);
    }

    protected function tearDown(): void
    {
        $GLOBALS['__wp_options'] = [];

        bc_test_uninstall_pro_addon();
    }

    public function testAnUnsavedForumIsOn(): void
    {
        $this->assertTrue(NotificationSettings::isEnabled([]));
        $this->assertTrue(NotificationSettings::isEnabled(null));
        $this->assertFalse(NotificationSettings::isEnabled(['enabled' => false]));
    }

    public function testATypeSavedBeforeItExistedReadsAsItsDefaultNotAsOff(): void
    {
        $row = NotificationSettings::forType(['types' => []], NotificationTypes::MENTION);

        $this->assertSame(NotificationTypes::channelDefaults(NotificationTypes::MENTION), [
            'inapp' => $row['inapp'],
            'email' => $row['email'],
        ]);
        $this->assertTrue($row['userMayOverride'], 'members may choose until an admin says otherwise');
    }

    public function testEveryTypeIsAccountedForAfterNormalising(): void
    {
        $normalized = NotificationSettings::normalize(['types' => ['spam' => ['inapp' => true]]]);

        $this->assertSame(NotificationTypes::values(), array_keys($normalized['types']));
    }

    /**
     * Zero would delete a notification the moment it was read, which reads as the
     * feature being broken rather than as tidy housekeeping.
     */
    public function testRetentionIsFlooredAtAWeek(): void
    {
        $this->assertSame(7, NotificationSettings::retentionDays(['retentionDays' => 0]));
        $this->assertSame(7, NotificationSettings::retentionDays(['retentionDays' => -30]));
        $this->assertSame(3650, NotificationSettings::retentionDays(['retentionDays' => 99999]));
        $this->assertSame(
            NotificationSettings::RETENTION_DAYS_DEFAULT,
            NotificationSettings::retentionDays([])
        );
    }

    public function testTheDigestHourIsAlwaysOnTheClock(): void
    {
        $this->assertSame(0, NotificationSettings::digestHour(['digestHour' => -1]));
        $this->assertSame(23, NotificationSettings::digestHour(['digestHour' => 25]));
        $this->assertSame(14, NotificationSettings::digestHour(['digestHour' => '14']));
    }

    public function testOnlyKnownFrequenciesSurvive(): void
    {
        $this->assertSame(
            NotificationSettings::FREQUENCY_INSTANT,
            NotificationSettings::defaultFrequency(['defaultFrequency' => 'fortnightly'])
        );
        $this->assertSame(
            NotificationSettings::FREQUENCY_WEEKLY,
            NotificationSettings::defaultFrequency(['defaultFrequency' => 'weekly'])
        );
    }

    public function testTheSenderFallsBackToTheSiteAndNotToAPerson(): void
    {
        $this->assertSame('Bit Flows Forum', NotificationSettings::fromName([]));
        $this->assertSame('Bit Flows Forum', NotificationSettings::fromName(['fromName' => '   ']));
        $this->assertSame('Community', NotificationSettings::fromName(['fromName' => 'Community']));

        // Replies to a notification should not land in the admin's own mail.
        $this->assertSame('wordpress@forum.example.com', NotificationSettings::fromEmail([]));
        $this->assertSame(
            'wordpress@forum.example.com',
            NotificationSettings::fromEmail(['fromEmail' => 'not-an-address'])
        );
        $this->assertSame(
            'noreply@forum.example.com',
            NotificationSettings::fromEmail(['fromEmail' => 'noreply@forum.example.com'])
        );
    }

    public function testOnlyTheQueueAlertIsModeratorOnly(): void
    {
        foreach (NotificationTypes::cases() as $type) {
            $this->assertSame(
                $type === NotificationTypes::REPORT_FILED,
                NotificationTypes::isModeratorOnly($type),
                $type->value
            );
        }

        $this->assertNotContains(NotificationTypes::REPORT_FILED, NotificationTypes::memberTypes());
    }

    /**
     * A vote carries nothing of its own to read, so fifty of them are one fact.
     * A reply is the opposite — each is something somebody wrote — so collapsing
     * one would lose a link to real content.
     */
    public function testOnlyVotesCollapse(): void
    {
        foreach (NotificationTypes::cases() as $type) {
            $this->assertSame(
                $type === NotificationTypes::VOTE_RECEIVED,
                NotificationTypes::isCollapsible($type),
                $type->value
            );
        }
    }

    public function testEmailStartsOnOnlyWhereItIsAddressedToOnePerson(): void
    {
        $emailing = array_values(
            array_filter(
                NotificationTypes::cases(),
                static fn (NotificationTypes $type): bool => NotificationTypes::channelDefaults($type)['email']
            )
        );

        $this->assertNotContains(
            NotificationTypes::VOTE_RECEIVED,
            $emailing,
            'nobody wants mail every time a stranger upvotes them'
        );
        $this->assertNotContains(NotificationTypes::TOPIC_NEW, $emailing);
        $this->assertContains(NotificationTypes::MENTION, $emailing);
        $this->assertContains(NotificationTypes::CONTENT_ACTIONED, $emailing);

        foreach (NotificationTypes::cases() as $type) {
            $this->assertTrue(
                NotificationTypes::channelDefaults($type)['inapp'],
                $type->value . ' costs the member nothing in the app and is why they have a bell'
            );
        }
    }
}
