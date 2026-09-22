<?php

namespace BitApps\BitConnect\Tests\Services;

use BitApps\BitConnect\Enum\NotificationSettings;
use BitApps\BitConnect\Enum\NotificationTypes;
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

        // No listeners: the digest schedule and the clamps under test here are
        // this plugin's own, and the sender and wording resolve to its own
        // values when nothing supplies others. NotificationMailIdentityTest is
        // where a supplied sender is exercised.
        $GLOBALS['__wp_options'] = [];
        $GLOBALS['__wp_filters'] = [];
    }

    protected function tearDown(): void
    {
        $GLOBALS['__wp_options'] = [];
        $GLOBALS['__wp_filters'] = [];
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

    /**
     * The sender is the site, and a stored sender is not consulted.
     *
     * The `fromName`/`fromEmail` keys are passed in deliberately: sites that
     * ran an older build still have them in the option, and this plugin no
     * longer reads either. Supplying a sender is the add-on's, through
     * `bit_connect_mail_from_name` — see NotificationMailIdentityTest.
     */
    public function testTheSenderIsTheSiteAndNotAPerson(): void
    {
        $this->assertSame('Bit Flows Forum', NotificationSettings::fromName([]));
        $this->assertSame('Bit Flows Forum', NotificationSettings::fromName(['fromName' => '   ']));
        $this->assertSame('Bit Flows Forum', NotificationSettings::fromName(['fromName' => 'Community']));

        // Replies to a notification should not land in the admin's own mail.
        $this->assertSame('wordpress@forum.example.com', NotificationSettings::fromEmail([]));
        $this->assertSame(
            'wordpress@forum.example.com',
            NotificationSettings::fromEmail(['fromEmail' => 'not-an-address'])
        );
        $this->assertSame(
            'wordpress@forum.example.com',
            NotificationSettings::fromEmail(['fromEmail' => 'noreply@forum.example.com'])
        );
    }

    public function testOnlyTheQueueAlertAndTheEveryTopicAlertAreModeratorOnly(): void
    {
        $moderatorOnly = [NotificationTypes::REPORT_FILED, NotificationTypes::TOPIC_POSTED];

        foreach (NotificationTypes::cases() as $type) {
            $this->assertSame(
                \in_array($type, $moderatorOnly, true),
                NotificationTypes::isModeratorOnly($type),
                $type->value
            );
        }

        foreach ($moderatorOnly as $type) {
            $this->assertNotContains($type, NotificationTypes::memberTypes());
        }
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
