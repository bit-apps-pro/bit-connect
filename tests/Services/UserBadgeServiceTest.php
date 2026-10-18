<?php

namespace BitApps\BitConnect\Tests\Services;

use BitApps\BitConnect\Enum\BadgeTone;
use BitApps\BitConnect\Enum\Capabilities;
use BitApps\BitConnect\Services\UserBadgeService;
use PHPUnit\Framework\TestCase;
use WP_User;

/**
 * Pins down the badge shown beside a member's name.
 *
 * Three surfaces name a member — the comment byline, the topic byline and the
 * profile card — and one resolver answers all three so they cannot disagree.
 *
 * This plugin labels nobody on its own: badges arrive through the
 * `bit_connect_assigned_member_badges` filter, and with nobody answering a
 * member's name is shown bare, whatever their capabilities. The cases below
 * stand in for a filter where they need a badge to exist.
 *
 * The other rule worth guarding: a badge is not authority. isStaff() reads
 * capabilities and ignores badges entirely, because the report queue exempts
 * staff from auto-hide — a cosmetic label must not grant immunity from reports.
 *
 * @internal
 *
 * @coversNothing
 */
final class UserBadgeServiceTest extends TestCase
{
    private const MEMBER = 3;

    protected function setUp(): void
    {
        UserBadgeService::flush();
    }

    protected function tearDown(): void
    {
        $GLOBALS['__wp_users'] = [];
        $GLOBALS['__wp_user_caps'] = [];
        $GLOBALS['__wp_user_meta'] = [];
        $GLOBALS['__wp_options'] = [];
        $GLOBALS['__wp_filters'] = [];

        UserBadgeService::flush();
    }

    // -----------------------------------------------------------------------
    // Nobody is labelled unless a filter says so
    // -----------------------------------------------------------------------

    /**
     * Capabilities grant authority, not a badge: with nobody answering the
     * filter, the people who run the forum are shown by name like everyone else.
     */
    public function testStaffCarryNoBadgeOfTheirOwn(): void
    {
        $this->seedUser(self::MEMBER, [Capabilities::MANAGE->value, Capabilities::MODERATE->value]);

        $this->assertNull(UserBadgeService::for(self::MEMBER));
        $this->assertSame([], UserBadgeService::all(self::MEMBER));
    }

    public function testTheFilterSuppliesTheBadgesInPriorityOrder(): void
    {
        $this->seedUser(self::MEMBER, []);
        $this->assign([
            ['id' => 'developer', 'label' => 'Developer', 'tone' => 'green'],
            ['id' => 'support', 'label' => 'Support', 'tone' => 'teal'],
        ]);

        $this->assertSame('Developer', UserBadgeService::for(self::MEMBER)['label']);
        $this->assertSame(['developer', 'support'], array_column(UserBadgeService::all(self::MEMBER), 'id'));
    }

    public function testMalformedBadgesFromTheFilterAreDropped(): void
    {
        $this->seedUser(self::MEMBER, []);
        $this->assign(['Team', ['label' => '  '], ['label' => 'Support', 'tone' => 'chartreuse']]);

        $badges = UserBadgeService::all(self::MEMBER);

        $this->assertCount(1, $badges);
        $this->assertSame(BadgeTone::MODERATOR->value, $badges[0]['tone']);
    }

    /**
     * Null rather than a "Member" badge: an ordinary member's byline shows no
     * tag at all, so the caller renders on presence.
     */
    public function testAnOrdinaryMemberCarriesNoBadge(): void
    {
        $this->seedUser(self::MEMBER, []);

        $this->assertNull(UserBadgeService::for(self::MEMBER));
        $this->assertSame([], UserBadgeService::all(self::MEMBER));
    }

    public function testNobodyCarriesNoBadge(): void
    {
        $this->assertNull(UserBadgeService::for(0));
        $this->assertSame([], UserBadgeService::all(0));
        $this->assertNull(UserBadgeService::for(404));
    }

    // -----------------------------------------------------------------------
    // The label helper
    // -----------------------------------------------------------------------

    /**
     * Keeps roleLabel()'s contract, which has always answered a plain string
     * and named ordinary members 'Member'.
     */
    public function testTheLabelHelperNamesAnOrdinaryMemberMember(): void
    {
        $this->seedUser(self::MEMBER, []);

        $this->assertSame('Member', UserBadgeService::label(self::MEMBER));
        $this->assertSame('Guest', UserBadgeService::label(self::MEMBER, 'Guest'));
    }

    public function testTheLabelHelperAnswersTheBadgeWhenThereIsOne(): void
    {
        $this->seedUser(self::MEMBER, []);
        $this->assign([['label' => 'Developer', 'tone' => 'green']]);

        $this->assertSame('Developer', UserBadgeService::label(self::MEMBER));
    }

    // -----------------------------------------------------------------------
    // Authority is not a badge
    // -----------------------------------------------------------------------

    public function testStaffIsReadFromCapabilitiesRatherThanFromBadges(): void
    {
        $this->seedUser(self::MEMBER, [Capabilities::MODERATE->value]);

        $this->assertNull(UserBadgeService::for(self::MEMBER));
        $this->assertTrue(UserBadgeService::isStaff(self::MEMBER));
    }

    public function testABadgeDoesNotMakeSomeoneStaff(): void
    {
        $this->seedUser(self::MEMBER, []);
        $this->assign([['label' => 'Developer', 'tone' => 'green']]);

        $this->assertNotNull(UserBadgeService::for(self::MEMBER));
        $this->assertFalse(UserBadgeService::isStaff(self::MEMBER));
    }

    public function testNobodyAndTheDeletedAreNotStaff(): void
    {
        $this->assertFalse(UserBadgeService::isStaff(0));
        $this->assertFalse(UserBadgeService::isStaff(404));
    }

    // -----------------------------------------------------------------------
    // The rename filter
    // -----------------------------------------------------------------------

    /**
     * Lets a site call its people Team or Staff.
     */
    public function testAFilterMayRenameTheBadge(): void
    {
        $this->seedUser(self::MEMBER, []);
        $this->assign([['label' => 'Moderator', 'tone' => 'blue']]);
        $GLOBALS['__wp_filters']['bit_connect_member_badge'] = ['id' => null, 'label' => 'Team', 'tone' => 'teal'];

        $badge = UserBadgeService::for(self::MEMBER);

        $this->assertSame('Team', $badge['label']);
        $this->assertSame('teal', $badge['tone']);
    }

    public function testAFilterMayTakeTheBadgeAway(): void
    {
        $this->seedUser(self::MEMBER, []);
        $this->assign([['label' => 'Developer', 'tone' => 'green']]);
        $GLOBALS['__wp_filters']['bit_connect_member_badge'] = null;

        $this->assertNull(UserBadgeService::for(self::MEMBER));
    }

    public function testAFilterMayGiveABadgeToAMemberWhoHasNone(): void
    {
        $this->seedUser(self::MEMBER, []);
        $GLOBALS['__wp_filters']['bit_connect_member_badge'] = ['label' => 'Volunteer', 'tone' => 'amber'];

        $this->assertSame('Volunteer', UserBadgeService::for(self::MEMBER)['label']);
    }

    /**
     * A third party returning something unexpected must not put it into every
     * byline payload.
     */
    public function testAFilterReturningSomethingElseIsIgnored(): void
    {
        $this->seedUser(self::MEMBER, []);
        $this->assign([['label' => 'Developer', 'tone' => 'green']]);
        $GLOBALS['__wp_filters']['bit_connect_member_badge'] = 'Team';

        $this->assertNull(UserBadgeService::for(self::MEMBER));
    }

    public function testAFilteredBadgeWithNoLabelIsIgnored(): void
    {
        $this->seedUser(self::MEMBER, []);
        $this->assign([['label' => 'Developer', 'tone' => 'green']]);
        $GLOBALS['__wp_filters']['bit_connect_member_badge'] = ['label' => '   ', 'tone' => 'green'];

        $this->assertNull(UserBadgeService::for(self::MEMBER));
    }

    /**
     * Rendered as a CSS key, so it is restricted to the tones the portal knows
     * how to style.
     */
    public function testAFilteredBadgeWithAnUnknownToneIsStyledAnyway(): void
    {
        $this->seedUser(self::MEMBER, []);
        $this->assign([['label' => 'Developer', 'tone' => 'green']]);
        $GLOBALS['__wp_filters']['bit_connect_member_badge'] = ['label' => 'Team', 'tone' => 'chartreuse'];

        $this->assertSame(BadgeTone::MODERATOR->value, UserBadgeService::for(self::MEMBER)['tone']);
    }

    // -----------------------------------------------------------------------
    // The per-request memo
    // -----------------------------------------------------------------------

    /**
     * A hundred-comment thread asks for a badge a hundred times; without the
     * memo that is a hundred round trips for the same few authors.
     */
    public function testABadgeIsResolvedOncePerRequest(): void
    {
        $this->seedUser(self::MEMBER, []);
        $this->assign([['label' => 'Developer', 'tone' => 'green']]);

        UserBadgeService::for(self::MEMBER);
        $this->assign([]);

        $this->assertSame('Developer', UserBadgeService::for(self::MEMBER)['label']);
    }

    /**
     * Stands in for whatever answers the badge filter.
     *
     * @param list<mixed> $badges
     */
    private function assign(array $badges): void
    {
        $GLOBALS['__wp_filters']['bit_connect_assigned_member_badges'] = $badges;
    }

    /**
     * @param string[] $capabilities
     */
    private function seedUser(int $userId, array $capabilities): void
    {
        $user = new WP_User();
        $user->ID = $userId;
        $user->display_name = 'Member ' . $userId;

        $GLOBALS['__wp_users'][$userId] = $user;
        $GLOBALS['__wp_user_caps'][$userId] = array_fill_keys($capabilities, true);
    }
}
