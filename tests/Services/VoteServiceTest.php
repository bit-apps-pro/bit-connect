<?php

namespace BitApps\BitConnect\Tests\Services;

use BitApps\BitConnect\Config;
use BitApps\BitConnect\Enum\Capabilities;
use BitApps\BitConnect\Services\VoteService;
use BitApps\BitConnectPro\Utils\PluginCommonConfig;
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
            Capabilities::VOTE_POST->value    => true,
            Capabilities::VOTE_COMMENT->value => true,
        ];
        $GLOBALS['__wp_posts'] = [self::TOPIC => $this->topic()];
        $GLOBALS['__wp_comments'] = [self::COMMENT => $this->comment()];

        // Comment upvoting needs the forum to offer it and a licence to allow
        // it. Both are on here so the toggle itself is what these tests
        // exercise; the gate has its own case below.
        $GLOBALS['__wp_filters'] = [];
        $this->offerCommentUpvotes(true);
        $this->licence(true);
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
        set_transient('bc_vrl_' . self::VOTER, 1000, 60);

        $result = $this->votes->togglePostVote(self::VOTER, self::TOPIC);

        $this->assertFalse($result['success']);
        $this->assertTrue($result['denied']);
    }

    // -----------------------------------------------------------------------
    // Voting on a comment
    // -----------------------------------------------------------------------

    public function testACommentVoteIsRecordedAndTakenBackTheSameWay(): void
    {
        $added = $this->votes->toggleCommentVote(self::VOTER, self::COMMENT);
        $this->assertSame(['votes' => 1, 'hasVoted' => true], $added['data']);

        $removed = $this->votes->toggleCommentVote(self::VOTER, self::COMMENT);
        $this->assertSame(['votes' => 0, 'hasVoted' => false], $removed['data']);
    }

    /**
     * Two gates, and either one shut is enough. A member carrying the
     * capability still cannot vote on a comment in a forum that does not offer
     * comment upvotes, and a forum that offers them cannot hand them out
     * without a licence — checked at the service, not just in the portal, so a
     * stale page or a hand-made request gets the same answer.
     */
    public function testAForumThatDoesNotOfferCommentUpvotesRefusesTheVote(): void
    {
        $this->offerCommentUpvotes(false);

        $result = $this->votes->toggleCommentVote(self::VOTER, self::COMMENT);

        $this->assertFalse($result['success']);
        $this->assertSame([], $GLOBALS['__bc_votes']);
    }

    public function testAnUnlicensedForumRefusesTheVoteHoweverTheSettingReads(): void
    {
        $this->offerCommentUpvotes(true);
        $this->licence(false);

        $result = $this->votes->toggleCommentVote(self::VOTER, self::COMMENT);

        $this->assertFalse($result['success']);
        $this->assertSame([], $GLOBALS['__bc_votes']);
    }

    public function testAVoteOnACommentThatIsGoneIsRefused(): void
    {
        $this->assertFalse($this->votes->toggleCommentVote(self::VOTER, 404)['success']);
    }

    public function testCommentVotingHasAPermissionOfItsOwn(): void
    {
        $GLOBALS['__wp_caps'] = [Capabilities::VOTE_POST->value => true];

        $this->assertTrue($this->votes->togglePostVote(self::VOTER, self::TOPIC)['success']);
        $this->assertFalse($this->votes->toggleCommentVote(self::VOTER, self::COMMENT)['success']);
    }

    /**
     * A topic and a comment are separate things to vote on, even when the ids
     * happen to collide.
     */
    public function testATopicVoteAndACommentVoteAreCountedApart(): void
    {
        $this->votes->togglePostVote(self::VOTER, self::TOPIC);
        $this->votes->toggleCommentVote(self::VOTER, self::COMMENT);

        $this->assertSame(1, $this->votes->getPostVoteCounts(self::TOPIC));
        $this->assertSame(1, $this->votes->getCommentVoteCounts(self::COMMENT));
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

    public function testACommentWithNoCachedTotalYetBuildsOneToo(): void
    {
        $GLOBALS['__bc_votes'] = [['user_id' => 3, 'post_id' => null, 'comment_id' => self::COMMENT]];

        $this->assertSame(1, $this->votes->getCommentVoteCounts(self::COMMENT));
    }

    public function testSomethingNobodyHasVotedOnCountsZero(): void
    {
        $this->assertSame(0, $this->votes->getPostVoteCounts(self::TOPIC));
        $this->assertSame(0, $this->votes->getCommentVoteCounts(self::COMMENT));
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

    public function testTheAuthorIsToldWhenSomeoneUpvotesTheirComment(): void
    {
        $this->votes->toggleCommentVote(self::VOTER, self::COMMENT);

        $this->assertCount(1, $GLOBALS['__bc_notifications']);
        $this->assertSame(self::AUTHOR, $GLOBALS['__bc_notifications'][0]['user_id']);
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

    public function testDeletingACommentTakesItsVotesAndItsCachedTotal(): void
    {
        $this->votes->toggleCommentVote(self::VOTER, self::COMMENT);

        $this->assertTrue($this->votes->deleteCommentVotes(self::COMMENT));
        $this->assertSame([], $GLOBALS['__bc_votes']);
    }

    /**
     * Left behind, a deleted member's votes keep counting towards totals nobody
     * can trace back to a person.
     */
    public function testDeletingAnAccountTakesEveryVoteItCast(): void
    {
        $this->votes->togglePostVote(self::VOTER, self::TOPIC);
        $this->votes->toggleCommentVote(self::VOTER, self::COMMENT);
        $this->votes->togglePostVote(4, self::TOPIC);

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

    /** Whether the forum offers comment upvotes at all. */
    private function offerCommentUpvotes(bool $offered): void
    {
        $GLOBALS['__wp_options']['bit_connect_admin_settings'] = [
            'topicAccess' => ['commentUpvote' => $offered],
        ];
    }

    private function licence(bool $valid): void
    {
        // The add-on registers its listeners only while licensed.
        $valid ? bc_test_install_pro_addon(['comment_upvotes']) : bc_test_uninstall_pro_addon();

        PluginCommonConfig::setProPluginPrefix('bit_connect_pro_');
        $GLOBALS['__wp_options']['bit_connect_pro_license_data'] = [
            'key'    => 'test-key',
            'status' => $valid ? 'success' : 'expired',
        ];
    }
}
