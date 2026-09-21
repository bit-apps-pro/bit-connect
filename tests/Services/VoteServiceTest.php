<?php

namespace BitApps\BitConnect\Tests\Services;

use BitApps\BitConnect\Config;
use BitApps\BitConnect\Enum\Capabilities;
use BitApps\BitConnect\Services\VoteService;
use PHPUnit\Framework\TestCase;
use WP_Comment;
use WP_Post;

/**
 * Pins down what an upvote does, and what it does the second time.
 *
 * A vote is a toggle, and the failure mode of a toggle is silent: a second
 * press that adds another row leaves a member able to upvote the same topic
 * repeatedly, which nothing surfaces except the count being wrong. The cached
 * total is the other half — every listing reads it rather than counting rows,
 * so a cache that is not rebuilt shows the old number indefinitely.
 *
 * The notification rides the vote and not the toggle, deliberately: pairing
 * them would let one person flick a notification in and out of somebody's bell.
 *
 * @internal
 *
 * @coversNothing
 */
final class VoteServiceTest extends TestCase
{
    private const VOTER = 3;

    private const AUTHOR = 7;

    private const TOPIC = 1491;

    private const COMMENT = 55;

    private VoteService $votes;

    protected function setUp(): void
    {
        $this->votes = new VoteService();

        $GLOBALS['__bc_votes'] = [];
        $GLOBALS['__bc_notifications'] = [];
        $GLOBALS['__wp_post_meta'] = [];
        $GLOBALS['__wp_comment_meta'] = [];
        $GLOBALS['__wp_transients'] = [];
        $GLOBALS['__wp_options'] = [];
        $GLOBALS['__wp_user_meta'] = [];
        $GLOBALS['__wp_current_user_id'] = self::VOTER;
        $GLOBALS['__wp_caps'] = [
            Capabilities::VOTE_POST->value => true,
        ];
        $GLOBALS['__wp_posts'] = [self::TOPIC => $this->topic()];
        $GLOBALS['__wp_comments'] = [self::COMMENT => $this->comment()];

        $GLOBALS['__wp_filters'] = [];
    }

    protected function tearDown(): void
    {
        $GLOBALS['__bc_votes'] = [];
        $GLOBALS['__bc_notifications'] = [];
        $GLOBALS['__wp_posts'] = [];
        $GLOBALS['__wp_comments'] = [];
        $GLOBALS['__wp_caps'] = [];
        $GLOBALS['__wp_current_user_id'] = 0;
    }

    // -----------------------------------------------------------------------
    // Voting on a topic
    // -----------------------------------------------------------------------

    public function testAFirstVoteIsRecordedAndCounted(): void
    {
        $result = $this->votes->togglePostVote(self::VOTER, self::TOPIC);

        $this->assertTrue($result['success']);
        $this->assertSame(['votes' => 1, 'hasVoted' => true], $result['data']);
    }

    public function testVotingAgainTakesTheVoteBack(): void
    {
        $this->votes->togglePostVote(self::VOTER, self::TOPIC);

        $result = $this->votes->togglePostVote(self::VOTER, self::TOPIC);

        $this->assertTrue($result['success']);
        $this->assertSame(['votes' => 0, 'hasVoted' => false], $result['data']);
    }

    /**
     * The count is the sum of everyone's votes, and each member's own answer is
     * only about their own.
     */
    public function testOneMembersVoteDoesNotBecomeAnothers(): void
    {
        $this->votes->togglePostVote(self::VOTER, self::TOPIC);
        $this->votes->togglePostVote(4, self::TOPIC);

        $this->assertSame(2, $this->votes->getPostVoteCounts(self::TOPIC));
        $this->assertTrue($this->votes->getPostVoteStatus(self::TOPIC, 4)['hasVoted']);
        $this->assertFalse($this->votes->getPostVoteStatus(self::TOPIC, 9)['hasVoted']);
    }

    public function testAVoteOnSomethingThatIsNotATopicIsRefused(): void
    {
        $result = $this->votes->togglePostVote(self::VOTER, 404);

        $this->assertFalse($result['success']);
        $this->assertSame([], $GLOBALS['__bc_votes']);
    }

    /**
     * A page or a post from another plugin is not a forum topic, however
     * plausible the id looks.
     */
    public function testAVoteOnAnotherPostTypeIsRefused(): void
    {
        $page = new WP_Post();
        $page->ID = 900;
        $page->post_type = 'page';
        $page->post_author = self::AUTHOR;
        $GLOBALS['__wp_posts'][900] = $page;

        $this->assertFalse($this->votes->togglePostVote(self::VOTER, 900)['success']);
    }

    public function testAMemberWithoutThePermissionIsRefusedAndToldSo(): void
    {
        $GLOBALS['__wp_caps'] = [];

        $result = $this->votes->togglePostVote(self::VOTER, self::TOPIC);

        $this->assertFalse($result['success']);
        $this->assertTrue($result['denied']);
        $this->assertSame([], $GLOBALS['__bc_votes']);
    }

    /**
     * Marked as denied rather than as an error so the portal can tell "you may
     * not" from "that did not work" and say the right thing.
     */
    public function testSomeoneVotingTooFastIsThrottledRatherThanErrored(): void
    {
        set_transient('bit_connect_vrl_' . self::VOTER, 1000, 60);

        $result = $this->votes->togglePostVote(self::VOTER, self::TOPIC);

        $this->assertFalse($result['success']);
        $this->assertTrue($result['denied']);
    }

    // -----------------------------------------------------------------------
    // Voting on a comment, which this plugin does not do
    // -----------------------------------------------------------------------

    /**
     * There is no way to cast a vote on a reply through this service.
     *
     * The guideline 5 fix, pinned as a fact about the class rather than as
     * behaviour: upvoting an individual reply is implemented in the Bit
     * Connect Pro add-on and is not present here in any form — not switched
     * off by a licence, not switched off by a setting, simply absent. If a
     * method by this name ever comes back to the free plugin, this fails and
     * whoever added it has to make the case.
     */
    public function testThisPluginHasNoWayToCastACommentVote(): void
    {
        $this->assertFalse(
            method_exists($this->votes, 'toggleCommentVote'),
            'Casting a vote on a reply belongs to the add-on, not to the free plugin.'
        );
        $this->assertFalse(method_exists($this->votes, 'getCommentVoteStatus'));
        $this->assertFalse(method_exists($this->votes, 'getCommentVoteCounts'));
    }

    // -----------------------------------------------------------------------
    // The cached total
    // -----------------------------------------------------------------------

    public function testTheCachedTotalIsKeptInStepWithTheVotes(): void
    {
        $this->votes->togglePostVote(self::VOTER, self::TOPIC);

        $this->assertSame(1, $GLOBALS['__wp_post_meta'][self::TOPIC][VoteService::META_VOTE_COUNT]);

        $this->votes->togglePostVote(self::VOTER, self::TOPIC);

        $this->assertSame(0, $GLOBALS['__wp_post_meta'][self::TOPIC][VoteService::META_VOTE_COUNT]);
    }

    /**
     * Every listing reads the cached total rather than counting rows, so a
     * topic that predates the cache has to build one on first read instead of
     * reporting zero forever.
     */
    public function testATopicWithNoCachedTotalYetBuildsOneOnFirstRead(): void
    {
        $GLOBALS['__bc_votes'] = [
            ['user_id' => 3, 'post_id' => self::TOPIC, 'comment_id' => null],
            ['user_id' => 4, 'post_id' => self::TOPIC, 'comment_id' => null],
        ];

        $this->assertSame(2, $this->votes->getPostVoteCounts(self::TOPIC));
        $this->assertSame(2, $GLOBALS['__wp_post_meta'][self::TOPIC][VoteService::META_VOTE_COUNT]);
    }

    public function testSomethingNobodyHasVotedOnCountsZero(): void
    {
        $this->assertSame(0, $this->votes->getPostVoteCounts(self::TOPIC));
    }

    /**
     * A logged-out reader sees the count and no vote of their own.
     */
    public function testAVisitorWhoIsNotSignedInHasNotVoted(): void
    {
        $this->votes->togglePostVote(self::VOTER, self::TOPIC);
        $GLOBALS['__wp_current_user_id'] = 0;

        $status = $this->votes->getPostVoteStatus(self::TOPIC);

        $this->assertSame(1, $status['votes']);
        $this->assertFalse($status['hasVoted']);
    }

    // -----------------------------------------------------------------------
    // Telling the author
    // -----------------------------------------------------------------------

    public function testTheAuthorIsToldWhenSomeoneUpvotesTheirTopic(): void
    {
        $this->votes->togglePostVote(self::VOTER, self::TOPIC);

        $this->assertCount(1, $GLOBALS['__bc_notifications']);
        $this->assertSame(self::AUTHOR, $GLOBALS['__bc_notifications'][0]['user_id']);
    }

    /**
     * Un-voting is not an event anyone needs telling about, and pairing the two
     * would let one person toggle a notification in and out of somebody's bell.
     */
    public function testNobodyIsToldWhenAVoteIsTakenBack(): void
    {
        $this->votes->togglePostVote(self::VOTER, self::TOPIC);
        $this->votes->togglePostVote(self::VOTER, self::TOPIC);

        $this->assertCount(1, $GLOBALS['__bc_notifications']);
    }

    public function testNobodyIsToldAboutTheirOwnUpvote(): void
    {
        // The vote is attributed by the id passed in, the notification by the
        // signed-in user, so an author upvoting their own topic is both.
        $GLOBALS['__wp_current_user_id'] = self::AUTHOR;

        $this->votes->togglePostVote(self::AUTHOR, self::TOPIC);

        $this->assertSame([], $GLOBALS['__bc_notifications']);
    }

    /**
     * A vote moves the "Upvotes" figure on the author's profile card, and
     * nothing in core announces one.
     */
    public function testTheAuthorsCachedProfileTotalsAreDropped(): void
    {
        set_transient(Config::VAR_PREFIX . 'user_stats_' . self::AUTHOR, ['upvotes' => 0], 3600);

        $this->votes->togglePostVote(self::VOTER, self::TOPIC);

        $this->assertFalse(get_transient(Config::VAR_PREFIX . 'user_stats_' . self::AUTHOR));
    }

    // -----------------------------------------------------------------------
    // Cleaning up
    // -----------------------------------------------------------------------

    public function testDeletingATopicTakesItsVotesAndItsCachedTotal(): void
    {
        $this->votes->togglePostVote(self::VOTER, self::TOPIC);

        $this->assertTrue($this->votes->deletePostVotes(self::TOPIC));
        $this->assertSame([], $GLOBALS['__bc_votes']);
        $this->assertArrayNotHasKey(VoteService::META_VOTE_COUNT, $GLOBALS['__wp_post_meta'][self::TOPIC]);
    }

    /**
     * Left behind, a deleted member's votes keep counting towards totals nobody
     * can trace back to a person.
     */
    public function testDeletingAnAccountTakesEveryVoteItCast(): void
    {
        $this->votes->togglePostVote(self::VOTER, self::TOPIC);
        $this->votes->togglePostVote(4, self::TOPIC);
        // A reply vote the add-on cast, seeded directly: closing an account
        // takes every vote the member left behind, not only the ones this
        // plugin knows how to cast.
        $GLOBALS['__bc_votes'][] = [
            'user_id' => self::VOTER, 'post_id' => null, 'comment_id' => self::COMMENT,
        ];

        $this->assertTrue($this->votes->deleteUserVotes(self::VOTER));

        $this->assertSame(1, \count($GLOBALS['__bc_votes']));
        $this->assertFalse($this->votes->getPostVoteStatus(self::TOPIC, self::VOTER)['hasVoted']);
    }

    public function testDeletingVotesForSomethingThatHadNoneReportsNothingRemoved(): void
    {
        $this->assertFalse($this->votes->deletePostVotes(self::TOPIC));
        $this->assertFalse($this->votes->deleteUserVotes(self::VOTER));
    }

    // -----------------------------------------------------------------------
    // Helpers
    // -----------------------------------------------------------------------

    private function topic(): WP_Post
    {
        $post = new WP_Post();
        $post->ID = self::TOPIC;
        $post->post_author = self::AUTHOR;
        $post->post_type = 'bit-connect';
        $post->post_title = 'Cannot log in';
        $post->post_status = 'publish';

        return $post;
    }

    private function comment(): WP_Comment
    {
        $comment = new WP_Comment();
        $comment->comment_ID = self::COMMENT;
        $comment->user_id = self::AUTHOR;
        $comment->comment_post_ID = self::TOPIC;
        $comment->comment_content = 'Same here.';
        $comment->comment_approved = '1';

        return $comment;
    }

}
