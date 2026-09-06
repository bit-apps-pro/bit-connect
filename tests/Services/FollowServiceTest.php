<?php

namespace BitApps\BitConnect\Tests\Services;

use BitApps\BitConnect\Model\Follow;
use BitApps\BitConnect\Services\FollowService;
use PHPUnit\Framework\TestCase;

/**
 * Pins down what following, unfollowing and muting actually do.
 *
 * Unfollowing mutes rather than deletes, and that is the whole design. A
 * deleted row would be recreated by auto-follow the next time the member
 * replied to the thread they had just silenced, so "I never want to hear about
 * this again" would last until their next sentence.
 *
 * Which is also why the two ways of gaining a follow behave differently:
 * pressing Follow is a decision and unmutes, while being subscribed for taking
 * part is incidental and must never undo one.
 *
 * @internal
 *
 * @coversNothing
 */
final class FollowServiceTest extends TestCase
{
    private const MEMBER = 3;

    private const TOPIC = 9;

    protected function setUp(): void
    {
        $GLOBALS['__bc_follows'] = [];
        $GLOBALS['__wpdb_calls'] = [];
        $GLOBALS['wpdb']->failWrites = false;

        unset($GLOBALS['__bc_follow_insert_fails']);
    }

    protected function tearDown(): void
    {
        $GLOBALS['__bc_follows'] = [];
        $GLOBALS['__wpdb_calls'] = [];
        $GLOBALS['wpdb']->failWrites = false;

        unset($GLOBALS['__bc_follow_insert_fails']);
    }

    // -----------------------------------------------------------------------
    // Following
    // -----------------------------------------------------------------------

    public function testPressingFollowSubscribesTheMember(): void
    {
        $this->assertTrue(FollowService::follow(self::MEMBER, Follow::TARGET_TOPIC, self::TOPIC));

        $this->assertSame(
            ['following' => true, 'muted' => false, 'source' => Follow::SOURCE_MANUAL],
            FollowService::stateFor(self::MEMBER, Follow::TARGET_TOPIC, self::TOPIC)
        );
    }

    public function testPressingFollowTwiceLeavesOneSubscription(): void
    {
        FollowService::follow(self::MEMBER, Follow::TARGET_TOPIC, self::TOPIC);

        $this->assertTrue(FollowService::follow(self::MEMBER, Follow::TARGET_TOPIC, self::TOPIC));
        $this->assertCount(1, $GLOBALS['__bc_follows']);
    }

    /**
     * The button's job is to leave the member following and listening, whatever
     * state they were in — pressing Follow on something you muted plainly means
     * you want it back.
     */
    public function testPressingFollowOnSomethingMutedUnmutesIt(): void
    {
        FollowService::unfollow(self::MEMBER, Follow::TARGET_TOPIC, self::TOPIC);

        $this->assertTrue(FollowService::follow(self::MEMBER, Follow::TARGET_TOPIC, self::TOPIC));
        $this->assertFalse(FollowService::hasMuted(self::MEMBER, Follow::TARGET_TOPIC, self::TOPIC));
    }

    // -----------------------------------------------------------------------
    // Being subscribed for taking part
    // -----------------------------------------------------------------------

    public function testTakingPartSubscribesTheMemberAutomatically(): void
    {
        FollowService::autoFollow(self::MEMBER, Follow::TARGET_TOPIC, self::TOPIC);

        $this->assertSame(
            Follow::SOURCE_AUTO,
            FollowService::stateFor(self::MEMBER, Follow::TARGET_TOPIC, self::TOPIC)['source']
        );
    }

    /**
     * A member who muted a thread and then replied to it once more has said
     * both things, and the mute is the more recent deliberate one.
     */
    public function testReplyingToAMutedThreadDoesNotUnmuteIt(): void
    {
        FollowService::unfollow(self::MEMBER, Follow::TARGET_TOPIC, self::TOPIC);

        FollowService::autoFollow(self::MEMBER, Follow::TARGET_TOPIC, self::TOPIC);

        $this->assertTrue(FollowService::hasMuted(self::MEMBER, Follow::TARGET_TOPIC, self::TOPIC));
    }

    public function testAnExistingManualFollowIsNotOverwrittenByAnAutomaticOne(): void
    {
        FollowService::follow(self::MEMBER, Follow::TARGET_TOPIC, self::TOPIC);

        FollowService::autoFollow(self::MEMBER, Follow::TARGET_TOPIC, self::TOPIC);

        $this->assertCount(1, $GLOBALS['__bc_follows']);
        $this->assertSame(
            Follow::SOURCE_MANUAL,
            FollowService::stateFor(self::MEMBER, Follow::TARGET_TOPIC, self::TOPIC)['source']
        );
    }

    // -----------------------------------------------------------------------
    // Unfollowing
    // -----------------------------------------------------------------------

    public function testUnfollowingMutesRatherThanDeletes(): void
    {
        FollowService::follow(self::MEMBER, Follow::TARGET_TOPIC, self::TOPIC);

        $this->assertTrue(FollowService::unfollow(self::MEMBER, Follow::TARGET_TOPIC, self::TOPIC));

        $this->assertCount(1, $GLOBALS['__bc_follows']);
        $this->assertTrue(FollowService::hasMuted(self::MEMBER, Follow::TARGET_TOPIC, self::TOPIC));
    }

    /**
     * Nothing to mute yet, but the member has still expressed a wish — and
     * auto-follow would honour it tomorrow if nothing were recorded.
     */
    public function testMutingSomethingNeverFollowedStillRecordsTheWish(): void
    {
        $this->assertTrue(FollowService::unfollow(self::MEMBER, Follow::TARGET_TOPIC, self::TOPIC));

        $this->assertTrue(FollowService::hasMuted(self::MEMBER, Follow::TARGET_TOPIC, self::TOPIC));
    }

    /**
     * The row survives so auto-follow cannot quietly undo the mute, but the
     * member should be offered "Follow", not "Unfollow".
     */
    public function testAMutedThreadIsOfferedFollowRatherThanUnfollow(): void
    {
        FollowService::unfollow(self::MEMBER, Follow::TARGET_TOPIC, self::TOPIC);

        $state = FollowService::stateFor(self::MEMBER, Follow::TARGET_TOPIC, self::TOPIC);

        $this->assertFalse($state['following']);
        $this->assertTrue($state['muted']);
    }

    /**
     * Zero rows changed means the value was already what was asked for, which
     * is a success from the caller's point of view.
     */
    public function testMutingSomethingAlreadyMutedSucceeds(): void
    {
        FollowService::unfollow(self::MEMBER, Follow::TARGET_TOPIC, self::TOPIC);

        $this->assertTrue(FollowService::unfollow(self::MEMBER, Follow::TARGET_TOPIC, self::TOPIC));
    }

    public function testAWriteThatCouldNotBeMadeIsReportedAsAFailure(): void
    {
        FollowService::follow(self::MEMBER, Follow::TARGET_TOPIC, self::TOPIC);
        $GLOBALS['wpdb']->failWrites = true;

        $this->assertFalse(FollowService::unfollow(self::MEMBER, Follow::TARGET_TOPIC, self::TOPIC));
    }

    public function testASubscriptionThatCouldNotBeStoredIsReportedAsAFailure(): void
    {
        $GLOBALS['__bc_follow_insert_fails'] = true;

        $this->assertFalse(FollowService::follow(self::MEMBER, Follow::TARGET_TOPIC, self::TOPIC));
    }

    // -----------------------------------------------------------------------
    // What counts as a target
    // -----------------------------------------------------------------------

    public function testTheFourThingsAMemberMayFollow(): void
    {
        foreach ([Follow::TARGET_TOPIC, Follow::TARGET_DEPARTMENT, Follow::TARGET_TAG, Follow::TARGET_FORUM] as $type) {
            $this->assertTrue(FollowService::isValidTargetType($type), $type . ' should be followable');
        }

        $this->assertFalse(FollowService::isValidTargetType('comment'));
        $this->assertFalse(FollowService::isValidTargetType(''));
    }

    /**
     * "The whole forum" has no id and is stored as 0. Every other target is a
     * real row, so a bug that loses an id must not quietly subscribe somebody
     * to target zero.
     */
    public function testTheForumIsFollowedWithNoIdWhileEverythingElseNeedsOne(): void
    {
        $this->assertTrue(FollowService::follow(self::MEMBER, Follow::TARGET_FORUM, 0));
        $this->assertFalse(FollowService::follow(self::MEMBER, Follow::TARGET_TOPIC, 0));
    }

    public function testTheForumCannotBeFollowedUnderAnId(): void
    {
        $this->assertFalse(FollowService::follow(self::MEMBER, Follow::TARGET_FORUM, 9));
    }

    public function testALoggedOutVisitorFollowsNothing(): void
    {
        $this->assertFalse(FollowService::follow(0, Follow::TARGET_TOPIC, self::TOPIC));
        $this->assertFalse(FollowService::hasMuted(0, Follow::TARGET_TOPIC, self::TOPIC));
        $this->assertSame([], $GLOBALS['__bc_follows']);
    }

    public function testAnUnknownTargetTypeIsNotFollowed(): void
    {
        $this->assertFalse(FollowService::follow(self::MEMBER, 'comment', 5));
        FollowService::autoFollow(self::MEMBER, 'comment', 5);

        $this->assertSame([], $GLOBALS['__bc_follows']);
    }

    // -----------------------------------------------------------------------
    // Who a notification reaches
    // -----------------------------------------------------------------------

    public function testTheDispatcherSeesEveryoneStillListening(): void
    {
        FollowService::follow(3, Follow::TARGET_TOPIC, self::TOPIC);
        FollowService::follow(4, Follow::TARGET_TOPIC, self::TOPIC);
        FollowService::unfollow(5, Follow::TARGET_TOPIC, self::TOPIC);

        $this->assertSame([3, 4], FollowService::followerIdsFor(Follow::TARGET_TOPIC, self::TOPIC));
    }

    public function testAnInvalidTargetHasNoFollowers(): void
    {
        FollowService::follow(3, Follow::TARGET_TOPIC, self::TOPIC);

        $this->assertSame([], FollowService::followerIdsFor('comment', self::TOPIC));
        $this->assertSame([], FollowService::followerIdsFor(Follow::TARGET_TOPIC, 0));
    }

    /**
     * Never having followed something is not a decision; muting it is. Recipient
     * rules that include somebody for another reason — a topic's own author,
     * most of all — have to be able to tell the two apart.
     */
    public function testNeverFollowedIsNotTheSameAsMuted(): void
    {
        $this->assertFalse(FollowService::hasMuted(self::MEMBER, Follow::TARGET_TOPIC, self::TOPIC));

        FollowService::unfollow(self::MEMBER, Follow::TARGET_TOPIC, self::TOPIC);

        $this->assertTrue(FollowService::hasMuted(self::MEMBER, Follow::TARGET_TOPIC, self::TOPIC));
    }

    public function testSomethingNeverFollowedHasNoState(): void
    {
        $this->assertSame(
            ['following' => false, 'muted' => false, 'source' => ''],
            FollowService::stateFor(self::MEMBER, Follow::TARGET_TOPIC, self::TOPIC)
        );
    }

    // -----------------------------------------------------------------------
    // A member's own list
    // -----------------------------------------------------------------------

    public function testAMembersListShowsOnlyWhatTheyAreStillListeningTo(): void
    {
        FollowService::follow(self::MEMBER, Follow::TARGET_TOPIC, 9);
        FollowService::follow(self::MEMBER, Follow::TARGET_TOPIC, 10);
        FollowService::unfollow(self::MEMBER, Follow::TARGET_TOPIC, 11);

        $mine = FollowService::mine(self::MEMBER, Follow::TARGET_TOPIC);

        $this->assertSame([9, 10], array_column($mine['data'], 'target_id'));
        $this->assertSame(2, $mine['pagination']['total']);
    }

    public function testAMembersListIsPaginated(): void
    {
        foreach (range(1, 5) as $topicId) {
            FollowService::follow(self::MEMBER, Follow::TARGET_TOPIC, $topicId);
        }

        $page = FollowService::mine(self::MEMBER, Follow::TARGET_TOPIC, 2, 2);

        $this->assertSame([3, 4], array_column($page['data'], 'target_id'));
        $this->assertSame(3, $page['pagination']['total_pages']);
        $this->assertSame(2, $page['pagination']['current_page']);
    }

    public function testAskingForPageZeroGivesTheFirstPage(): void
    {
        FollowService::follow(self::MEMBER, Follow::TARGET_TOPIC, 9);

        $this->assertSame(1, FollowService::mine(self::MEMBER, Follow::TARGET_TOPIC, 0)['pagination']['current_page']);
    }

    /**
     * A page size nobody asked for is a way to pull the whole table in one
     * request.
     */
    public function testTheRequestedPageSizeIsClamped(): void
    {
        FollowService::follow(self::MEMBER, Follow::TARGET_TOPIC, 9);

        $this->assertSame(100, FollowService::mine(self::MEMBER, Follow::TARGET_TOPIC, 1, 5000)['pagination']['per_page']);
        $this->assertSame(1, FollowService::mine(self::MEMBER, Follow::TARGET_TOPIC, 1, 0)['pagination']['per_page']);
    }

    public function testAMemberFollowingNothingGetsAnEmptyList(): void
    {
        $mine = FollowService::mine(self::MEMBER, Follow::TARGET_TOPIC);

        $this->assertSame([], $mine['data']);
        $this->assertSame(0, $mine['pagination']['total']);
    }

    // -----------------------------------------------------------------------
    // Deleting an account
    // -----------------------------------------------------------------------

    /**
     * WordPress cannot do this for us the way it does for user meta — these are
     * plugin tables.
     */
    public function testDeletingAnAccountDropsEverythingItFollowed(): void
    {
        FollowService::follow(self::MEMBER, Follow::TARGET_TOPIC, 9);
        FollowService::follow(self::MEMBER, Follow::TARGET_TOPIC, 10);
        FollowService::follow(4, Follow::TARGET_TOPIC, 9);

        FollowService::purgeUser(self::MEMBER);

        $this->assertSame([4], FollowService::followerIdsFor(Follow::TARGET_TOPIC, 9));
        $this->assertSame([], FollowService::mine(self::MEMBER, Follow::TARGET_TOPIC)['data']);
    }
}
