<?php

namespace BitApps\BitConnect\Tests\Services;

use BitApps\BitConnect\Enum\BadgeTone;
use BitApps\BitConnect\Enum\Capabilities;
use BitApps\BitConnect\Services\UserBadgeService;
use BitApps\BitConnectPro\Services\ProfileBadgeService;
use PHPUnit\Framework\TestCase;
use WP_User;

/**
 * Pins down the badge shown beside a member's name.
 *
 * Three surfaces name a member — the comment byline, the topic byline and the
 * profile card — and they used to disagree. The comment byline asked a helper
 * that answers manage_options || forum_manage, so the colleague who holds
 * forum_moderate alone carried no badge on their comments while their profile
 * page called them a Moderator. One resolver is what stops that recurring.
 *
 * The other rule worth guarding: a badge is not authority. isStaff() reads
 * capabilities and ignores badges entirely, because the report queue exempts
 * staff from auto-hide — and once an admin can hand out a Developer badge, the
 * older reading would have let a cosmetic label grant immunity from reports.
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
        ProfileBadgeService::flush();

        // Authoring badges is a pro feature, so the free plugin resolves them
        // through a filter and answers empty on its own. Standing in for the pro
        // add-on's handler here keeps these tests exercising the real seam
        // rather than a direct call that no longer exists.
        $GLOBALS['__wp_filters']['bit_connect_assigned_member_badges']
            = static fn ($badges, $userId) => ProfileBadgeService::badgesFor((int) $userId);
    }

    protected function tearDown(): void
    {
        $GLOBALS['__wp_users'] = [];
        $GLOBALS['__wp_user_caps'] = [];
        $GLOBALS['__wp_user_meta'] = [];
        $GLOBALS['__wp_options'] = [];
        $GLOBALS['__wp_filters'] = [];

        UserBadgeService::flush();
        ProfileBadgeService::flush();
    }

    // -----------------------------------------------------------------------
    // Standing, read from capabilities
    // -----------------------------------------------------------------------

    public function testSomeoneWhoManagesTheForumIsAnAdmin(): void
    {
        $this->seedUser(self::MEMBER, [Capabilities::MANAGE->value]);

        $badge = UserBadgeService::for(self::MEMBER);

        $this->assertSame('Admin', $badge['label']);
        $this->assertSame(BadgeTone::ADMIN->value, $badge['tone']);
        $this->assertNull($badge['id']);
    }

    /**
     * The case the shared resolver exists for: forum_moderate alone used to
     * carry no badge on comments.
     */
    public function testSomeoneWhoOnlyModeratesIsAModerator(): void
    {
        $this->seedUser(self::MEMBER, [Capabilities::MODERATE->value]);

        $this->assertSame('Moderator', UserBadgeService::for(self::MEMBER)['label']);
    }

    public function testAnAdminHoldingBothIsShownAsTheHigherOfTheTwo(): void
    {
        $this->seedUser(self::MEMBER, [Capabilities::MANAGE->value, Capabilities::MODERATE->value]);

        $this->assertSame('Admin', UserBadgeService::for(self::MEMBER)['label']);
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
    // Assigned badges
    // -----------------------------------------------------------------------

    /**
     * Someone given a Developer badge is being described deliberately; the
     * automatic standing badge is the less specific of the two.
     */
    public function testAnAssignedBadgeOutranksTheAutomaticOne(): void
    {
        $this->seedUser(self::MEMBER, [Capabilities::MODERATE->value]);
        ProfileBadgeService::save(['label' => 'Developer', 'tone' => 'green']);
        ProfileBadgeService::assign(self::MEMBER, ['developer']);

        $this->assertSame('Developer', UserBadgeService::for(self::MEMBER)['label']);
    }

    /**
     * A byline sits inline with the name and the timestamp; three badges would
     * push it onto a second row on every comment in the thread. The profile
     * card, which has the room, asks for all of them.
     */
    public function testTheBylineTakesOneBadgeWhileTheProfileCardTakesThemAll(): void
    {
        $this->seedUser(self::MEMBER, []);
        ProfileBadgeService::save(['label' => 'Developer']);
        ProfileBadgeService::save(['label' => 'Support']);
        ProfileBadgeService::assign(self::MEMBER, ['developer', 'support']);

        $this->assertSame('Developer', UserBadgeService::for(self::MEMBER)['label']);
        $this->assertCount(2, UserBadgeService::all(self::MEMBER));
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
        $this->seedUser(self::MEMBER, [Capabilities::MANAGE->value]);

        $this->assertSame('Admin', UserBadgeService::label(self::MEMBER));
    }

    // -----------------------------------------------------------------------
    // Authority is not a badge
    // -----------------------------------------------------------------------

    public function testStaffIsReadFromCapabilitiesRatherThanFromBadges(): void
    {
        $this->seedUser(self::MEMBER, [Capabilities::MODERATE->value]);

        $this->assertTrue(UserBadgeService::isStaff(self::MEMBER));
    }

    /**
     * The report queue exempts staff from auto-hide. A cosmetic label must not
     * quietly grant immunity from being reported.
     */
    public function testAnAssignedBadgeDoesNotMakeSomeoneStaff(): void
    {
        $this->seedUser(self::MEMBER, []);
        ProfileBadgeService::save(['label' => 'Developer']);
        ProfileBadgeService::assign(self::MEMBER, ['developer']);

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
     * Lets a site call its people Team or Staff without touching the capability
     * that earned the badge.
     */
    public function testAFilterMayRenameTheBadgeWithoutTouchingTheCapability(): void
    {
        $this->seedUser(self::MEMBER, [Capabilities::MODERATE->value]);
        $GLOBALS['__wp_filters']['bit_connect_member_badge'] = ['id' => null, 'label' => 'Team', 'tone' => 'teal'];

        $badge = UserBadgeService::for(self::MEMBER);

        $this->assertSame('Team', $badge['label']);
        $this->assertSame('teal', $badge['tone']);
        $this->assertTrue(UserBadgeService::isStaff(self::MEMBER));
    }

    public function testAFilterMayTakeTheBadgeAway(): void
    {
        $this->seedUser(self::MEMBER, [Capabilities::MANAGE->value]);
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
     * Taking the first badge away leaves the rest, rather than emptying a
     * profile card that had three things to say.
     */
    public function testTakingTheFirstBadgeAwayLeavesTheRest(): void
    {
        $this->seedUser(self::MEMBER, []);
        ProfileBadgeService::save(['label' => 'Developer']);
        ProfileBadgeService::save(['label' => 'Support']);
        ProfileBadgeService::assign(self::MEMBER, ['developer', 'support']);

        $GLOBALS['__wp_filters']['bit_connect_member_badge'] = null;

        $this->assertSame(['support'], array_column(UserBadgeService::all(self::MEMBER), 'id'));
    }

    /**
     * A third party returning something unexpected must not put it into every
     * byline payload.
     */
    public function testAFilterReturningSomethingElseIsIgnored(): void
    {
        $this->seedUser(self::MEMBER, [Capabilities::MANAGE->value]);
        $GLOBALS['__wp_filters']['bit_connect_member_badge'] = 'Team';

        $this->assertNull(UserBadgeService::for(self::MEMBER));
    }

    public function testAFilteredBadgeWithNoLabelIsIgnored(): void
    {
        $this->seedUser(self::MEMBER, [Capabilities::MANAGE->value]);
        $GLOBALS['__wp_filters']['bit_connect_member_badge'] = ['label' => '   ', 'tone' => 'green'];

        $this->assertNull(UserBadgeService::for(self::MEMBER));
    }

    /**
     * Rendered as a CSS key, so it is restricted to the tones the portal knows
     * how to style.
     */
    public function testAFilteredBadgeWithAnUnknownToneIsStyledAnyway(): void
    {
        $this->seedUser(self::MEMBER, [Capabilities::MANAGE->value]);
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
        $this->seedUser(self::MEMBER, [Capabilities::MANAGE->value]);

        UserBadgeService::for(self::MEMBER);
        $GLOBALS['__wp_user_caps'][self::MEMBER] = [];

        $this->assertSame('Admin', UserBadgeService::for(self::MEMBER)['label']);
    }

    /**
     * A rename that skipped the flush would go on printing the old label for
     * the rest of the request that made it.
     */
    public function testRewritingTheCatalogDropsTheMemo(): void
    {
        $this->seedUser(self::MEMBER, []);
        ProfileBadgeService::save(['label' => 'Developer']);
        ProfileBadgeService::assign(self::MEMBER, ['developer']);

        UserBadgeService::for(self::MEMBER);

        ProfileBadgeService::save(['id' => 'developer', 'label' => 'Engineering']);

        $this->assertSame('Engineering', UserBadgeService::for(self::MEMBER)['label']);
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
