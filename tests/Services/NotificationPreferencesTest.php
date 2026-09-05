<?php

namespace BitApps\BitConnect\Tests\Services;

use BitApps\BitConnect\Enum\Capabilities;
use BitApps\BitConnect\Enum\NotificationSettings;
use BitApps\BitConnect\Enum\NotificationTypes;
use BitApps\BitConnect\Services\NotificationPreferences;
use BitApps\BitConnectPro\Utils\PluginCommonConfig;
use PHPUnit\Framework\TestCase;

/**
 * Which channels fire, for whom.
 *
 * The three layers — forum switch, admin row, member choice — and the two ways
 * they can be got wrong: a default that should move people and does not, and a
 * cap that should not be departed from and is.
 *
 * @internal
 *
 * @coversNothing
 */
class NotificationPreferencesTest extends TestCase
{
    private const MEMBER = 7;

    private const MODERATOR = 8;

    protected function setUp(): void
    {
        $GLOBALS['__wp_options'] = [];
        $GLOBALS['__wp_user_meta'] = [];
        $GLOBALS['__wp_user_caps'] = [
            self::MODERATOR => [Capabilities::MODERATE->value => true],
        ];

        NotificationPreferences::flushSettings();
    }

    public function testAForumThatHasNeverBeenConfiguredStillNotifies(): void
    {
        $this->assertTrue(
            NotificationPreferences::wantsInApp(self::MEMBER, NotificationTypes::TOPIC_REPLY),
            'a forum upgrading into this feature should start notifying, not sit silent'
        );
    }

    public function testTheMasterSwitchStopsEverything(): void
    {
        $this->storeSettings(['enabled' => false]);

        foreach (NotificationTypes::cases() as $type) {
            $this->assertFalse(
                NotificationPreferences::wantsInApp(self::MODERATOR, $type),
                $type->value . ' must not be delivered while the forum is switched off'
            );
            $this->assertFalse(NotificationPreferences::wantsEmail(self::MODERATOR, $type));
        }
    }

    /**
     * The reason preferences are stored sparsely. A member who saved the screen
     * last year must still move when the admin changes a default they never
     * touched — otherwise the only people a default change misses are the
     * engaged ones.
     */
    public function testAnAdminDefaultMovesMembersWhoNeverChose(): void
    {
        NotificationPreferences::save(
            self::MEMBER,
            [NotificationTypes::TOPIC_REPLY->value => ['inapp' => false]]
        );

        $this->storeSettings(
            ['types' => [NotificationTypes::MENTION->value => ['email' => false]]]
        );

        $this->assertFalse(
            NotificationPreferences::wantsEmail(self::MEMBER, NotificationTypes::MENTION),
            'the member never chose for mentions, so the admin default decides'
        );
        $this->assertFalse(
            NotificationPreferences::wantsInApp(self::MEMBER, NotificationTypes::TOPIC_REPLY),
            'the one they did choose is still theirs'
        );
    }

    public function testAMembersChoiceBeatsTheAdminDefault(): void
    {
        $this->storeSettings(
            ['types' => [NotificationTypes::VOTE_RECEIVED->value => ['email' => false]]]
        );

        NotificationPreferences::save(
            self::MEMBER,
            [NotificationTypes::VOTE_RECEIVED->value => ['email' => true]]
        );

        $this->assertTrue(NotificationPreferences::wantsEmail(self::MEMBER, NotificationTypes::VOTE_RECEIVED));
    }

    /**
     * A cap, not a default: it overrides a choice already stored, including one
     * made before the lock went on.
     */
    public function testALockedTypeIgnoresWhatTheMemberAlreadyChose(): void
    {
        NotificationPreferences::save(
            self::MEMBER,
            [NotificationTypes::TOPIC_REPLY->value => ['email' => false]]
        );

        $this->storeSettings(
            [
                'types' => [
                    NotificationTypes::TOPIC_REPLY->value => ['email' => true, 'userMayOverride' => false],
                ],
            ]
        );

        $this->assertTrue(
            NotificationPreferences::wantsEmail(self::MEMBER, NotificationTypes::TOPIC_REPLY),
            'the admin answer stands over a stored choice once the row is locked'
        );
    }

    public function testALockedTypeCannotBeSavedOver(): void
    {
        $this->storeSettings(
            [
                'types' => [
                    NotificationTypes::TOPIC_REPLY->value => ['email' => true, 'userMayOverride' => false],
                ],
            ]
        );

        NotificationPreferences::save(
            self::MEMBER,
            [NotificationTypes::TOPIC_REPLY->value => ['email' => false]]
        );

        $stored = $GLOBALS['__wp_user_meta'][self::MEMBER][NotificationPreferences::META_KEY] ?? [];

        $this->assertSame(
            [],
            $stored['types'] ?? [],
            'a stale tab must not be able to store a choice the admin has withdrawn'
        );
    }

    /**
     * Being told your content was taken down is the counterpart of removal being
     * visible at all — see the note on Capabilities::DELETE_ANY.
     */
    public function testTheRemovalNoticeCannotBeSwitchedOff(): void
    {
        NotificationPreferences::save(
            self::MEMBER,
            [NotificationTypes::CONTENT_ACTIONED->value => ['inapp' => false]]
        );

        $this->assertTrue(
            NotificationPreferences::wantsInApp(self::MEMBER, NotificationTypes::CONTENT_ACTIONED)
        );
    }

    public function testTheRemovalNoticeIsStillOnlyInApp(): void
    {
        NotificationPreferences::save(
            self::MEMBER,
            [NotificationTypes::CONTENT_ACTIONED->value => ['email' => false]]
        );

        $this->assertFalse(
            NotificationPreferences::wantsEmail(self::MEMBER, NotificationTypes::CONTENT_ACTIONED),
            'mandatory governs the in-app record, not the inbox'
        );
    }

    public function testAMemberWhoWantsNoEmailAtAllGetsNone(): void
    {
        NotificationPreferences::save(self::MEMBER, [], NotificationSettings::FREQUENCY_NEVER);

        foreach (NotificationTypes::cases() as $type) {
            $this->assertFalse(NotificationPreferences::wantsEmail(self::MEMBER, $type));
        }

        $this->assertTrue(
            NotificationPreferences::wantsInApp(self::MEMBER, NotificationTypes::TOPIC_REPLY),
            'switching off email must not empty the bell as well'
        );
    }

    /**
     * A digest is "not yet", not "no". Folding the two together would silently
     * unsubscribe a member from types they had asked for the moment they chose
     * a daily summary.
     */
    public function testChoosingADigestKeepsTheMemberSubscribed(): void
    {
        NotificationPreferences::save(self::MEMBER, [], NotificationSettings::FREQUENCY_DAILY);

        $this->assertTrue(NotificationPreferences::wantsEmail(self::MEMBER, NotificationTypes::MENTION));
        $this->assertSame(
            NotificationSettings::FREQUENCY_DAILY,
            NotificationPreferences::frequencyFor(self::MEMBER)
        );
    }

    public function testAnUnknownFrequencyFallsBackToTheForumDefault(): void
    {
        // The forum default is only the forum's to set on a licensed site;
        // without one every read of it is instant, which would not exercise
        // the fallback this is about.
        $this->licence();

        $GLOBALS['__wp_user_meta'][self::MEMBER][NotificationPreferences::META_KEY] = ['frequency' => 'hourly'];
        $this->storeSettings(['defaultFrequency' => NotificationSettings::FREQUENCY_WEEKLY]);

        $this->assertSame(
            NotificationSettings::FREQUENCY_WEEKLY,
            NotificationPreferences::frequencyFor(self::MEMBER)
        );
    }

    public function testAModeratorOnlyTypeIsNeverDeliveredToAnOrdinaryMember(): void
    {
        $this->assertFalse(
            NotificationPreferences::wantsInApp(self::MEMBER, NotificationTypes::REPORT_FILED)
        );
        $this->assertTrue(
            NotificationPreferences::wantsInApp(self::MODERATOR, NotificationTypes::REPORT_FILED)
        );
    }

    public function testTheScreenHidesTheQueueRowFromOrdinaryMembers(): void
    {
        $memberTypes = array_column(NotificationPreferences::screenFor(self::MEMBER)['types'], 'type');
        $moderatorTypes = array_column(NotificationPreferences::screenFor(self::MODERATOR)['types'], 'type');

        $this->assertNotContains(NotificationTypes::REPORT_FILED->value, $memberTypes);
        $this->assertContains(NotificationTypes::REPORT_FILED->value, $moderatorTypes);
    }

    /**
     * The screen has to agree with what dispatch will actually do, or the member
     * is looking at a switch that describes nothing.
     */
    public function testTheScreenAgreesWithTheDispatcher(): void
    {
        $this->storeSettings(
            [
                'types' => [
                    NotificationTypes::MENTION->value => ['inapp' => false, 'email' => true],
                ],
            ]
        );

        foreach (NotificationPreferences::screenFor(self::MEMBER)['types'] as $row) {
            $type = NotificationTypes::from($row['type']);

            $this->assertSame(
                NotificationPreferences::wantsInApp(self::MEMBER, $type),
                $row['inapp'],
                $row['type'] . ' in-app row disagrees with the dispatcher'
            );
        }
    }

    public function testTheScreenMarksLockedRowsAndSaysWhy(): void
    {
        $this->storeSettings(
            [
                'types' => [
                    NotificationTypes::TOPIC_REPLY->value => ['userMayOverride' => false],
                ],
            ]
        );

        $rows = [];
        foreach (NotificationPreferences::screenFor(self::MEMBER)['types'] as $row) {
            $rows[$row['type']] = $row;
        }

        $this->assertTrue($rows[NotificationTypes::TOPIC_REPLY->value]['inappLocked']);
        $this->assertTrue($rows[NotificationTypes::TOPIC_REPLY->value]['emailLocked']);
        $this->assertFalse(
            $rows[NotificationTypes::TOPIC_REPLY->value]['alwaysDelivered'],
            'locked by the admin is not the same sentence as required by the forum'
        );

        $this->assertTrue($rows[NotificationTypes::CONTENT_ACTIONED->value]['inappLocked']);
        $this->assertTrue($rows[NotificationTypes::CONTENT_ACTIONED->value]['alwaysDelivered']);
        $this->assertFalse(
            $rows[NotificationTypes::CONTENT_ACTIONED->value]['emailLocked'],
            'the removal notice is required in the app and optional in the inbox'
        );
    }

    public function testSavingLeavesUntouchedTypesUnrecorded(): void
    {
        NotificationPreferences::save(
            self::MEMBER,
            [NotificationTypes::MENTION->value => ['email' => false]]
        );

        $stored = $GLOBALS['__wp_user_meta'][self::MEMBER][NotificationPreferences::META_KEY];

        $this->assertSame([NotificationTypes::MENTION->value], array_keys($stored['types']));
    }

    public function testSavingIgnoresATypeThatDoesNotExist(): void
    {
        NotificationPreferences::save(self::MEMBER, ['telepathy' => ['inapp' => true]]);

        $stored = $GLOBALS['__wp_user_meta'][self::MEMBER][NotificationPreferences::META_KEY];

        $this->assertSame([], $stored['types']);
    }

    private function storeSettings(array $settings): void
    {
        update_option('bit_connect_notification_settings', $settings);
        NotificationPreferences::flushSettings();
    }

    /**
     * Turn the pro licence on for tests that need a forum-set digest cadence.
     */
    private function licence(): void
    {
        bc_test_install_pro_addon(['notification_delivery', 'notification_wording']);

        PluginCommonConfig::setProPluginPrefix('bit_connect_pro_');
        $GLOBALS['__wp_options']['bit_connect_pro_license_data'] = [
            'key'    => 'test-key',
            'status' => 'success',
        ];
    }
}
