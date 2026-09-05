<?php

namespace BitApps\BitConnect\Tests\Services;

use BitApps\BitConnect\Enum\Capabilities;
use BitApps\BitConnect\Services\ContentVisibilityService;
use BitApps\BitConnect\Services\ReportService;
use PHPUnit\Framework\TestCase;
use WP_Comment;
use WP_Post;

/**
 * Pins down what hiding takes away and what it leaves.
 *
 * Hiding is reversible by design, and every part of that rests on one thing:
 * where the content was before is written down first. Lose that and a restore
 * has nothing to restore to — a draft comes back published, a comment that was
 * awaiting approval comes back approved.
 *
 * The author still sees their own hidden topic. Someone whose work vanishes
 * from the portal, from their profile and from its own URL with no explanation
 * has not been moderated, they have lost it.
 *
 * @internal
 *
 * @coversNothing
 */
final class ContentVisibilityServiceTest extends TestCase
{
    private const AUTHOR = 3;

    private const MODERATOR = 7;

    private const STRANGER = 9;

    protected function tearDown(): void
    {
        $GLOBALS['__wp_posts'] = [];
        $GLOBALS['__wp_comments'] = [];
        $GLOBALS['__wp_post_meta'] = [];
        $GLOBALS['__wp_comment_meta'] = [];
        $GLOBALS['__wp_caps'] = [];
        $GLOBALS['__wp_current_user_id'] = 0;
        $GLOBALS['__wp_post_statuses'] = [];

        unset($GLOBALS['__wp_update_post_error'], $GLOBALS['__wp_set_comment_status_fails']);
    }

    // -----------------------------------------------------------------------
    // Who may see hidden content
    // -----------------------------------------------------------------------

    public function testAModeratorMaySeeHiddenContent(): void
    {
        $this->asModerator();

        $this->assertTrue(ContentVisibilityService::canViewHidden());
    }

    public function testAnOrdinaryMemberMayNot(): void
    {
        $this->asMember(self::STRANGER);

        $this->assertFalse(ContentVisibilityService::canViewHidden());
    }

    public function testAnAuthorStillSeesTheirOwnHiddenTopic(): void
    {
        $this->asMember(self::AUTHOR);

        $this->assertTrue(ContentVisibilityService::isPostViewableWhileHidden(self::AUTHOR));
    }

    public function testSomeoneElsesHiddenTopicStaysOutOfSight(): void
    {
        $this->asMember(self::STRANGER);

        $this->assertFalse(ContentVisibilityService::isPostViewableWhileHidden(self::AUTHOR));
    }

    /**
     * Ownership is not folded into canViewHidden(): that answer also decides
     * whether a comment is replaced by a tombstone, and "or you wrote it" there
     * would show every reader their neighbours' hidden replies.
     */
    public function testOwnershipIsAskedSeparatelyFromModeration(): void
    {
        $this->asMember(self::AUTHOR);

        $this->assertTrue(ContentVisibilityService::isOwnContent(self::AUTHOR));
        $this->assertFalse(ContentVisibilityService::canViewHidden());
    }

    public function testALoggedOutVisitorOwnsNothing(): void
    {
        $GLOBALS['__wp_current_user_id'] = 0;

        $this->assertFalse(ContentVisibilityService::isOwnContent(0));
        $this->assertFalse(ContentVisibilityService::isPostViewableWhileHidden(0));
    }

    // -----------------------------------------------------------------------
    // Hiding and restoring a topic
    // -----------------------------------------------------------------------

    public function testHidingATopicRemembersWhereItWas(): void
    {
        $this->seedPost(10, 'draft');

        $this->assertTrue(ContentVisibilityService::hidePost(10));

        $this->assertSame(ContentVisibilityService::HIDDEN_STATUS, $GLOBALS['__wp_posts'][10]->post_status);
        $this->assertSame('draft', $GLOBALS['__wp_post_meta'][10][ContentVisibilityService::PREV_STATUS_META]);
    }

    public function testRestoringPutsATopicBackWhereItWas(): void
    {
        $this->seedPost(10, 'draft');
        ContentVisibilityService::hidePost(10);

        $this->assertTrue(ContentVisibilityService::restorePost(10));

        $this->assertSame('draft', $GLOBALS['__wp_posts'][10]->post_status);
        $this->assertArrayNotHasKey(ContentVisibilityService::PREV_STATUS_META, $GLOBALS['__wp_post_meta'][10]);
    }

    public function testHidingATopicThatIsAlreadyHiddenChangesNothing(): void
    {
        $this->seedPost(10, ContentVisibilityService::HIDDEN_STATUS);

        $this->assertFalse(ContentVisibilityService::hidePost(10));
        $this->assertSame([], $GLOBALS['__wp_post_meta'][10] ?? []);
    }

    public function testHidingSomethingThatIsNotThereFails(): void
    {
        $this->assertFalse(ContentVisibilityService::hidePost(404));
    }

    public function testRestoringATopicThatWasNeverHiddenFails(): void
    {
        $this->seedPost(10, 'publish');

        $this->assertFalse(ContentVisibilityService::restorePost(10));
    }

    /**
     * A topic hidden by an older build has no remembered status. It still has
     * to come back to something, and publish is what all but a handful were.
     */
    public function testATopicWithNoRememberedStatusComesBackPublished(): void
    {
        $this->seedPost(10, ContentVisibilityService::HIDDEN_STATUS);

        $this->assertTrue(ContentVisibilityService::restorePost(10));
        $this->assertSame('publish', $GLOBALS['__wp_posts'][10]->post_status);
    }

    /**
     * A remembered status of "hidden" is meaningless — restoring to it would
     * leave the topic exactly where it was.
     */
    public function testARememberedHiddenStatusIsNotRestoredTo(): void
    {
        $this->seedPost(10, ContentVisibilityService::HIDDEN_STATUS);
        $GLOBALS['__wp_post_meta'][10][ContentVisibilityService::PREV_STATUS_META] = ContentVisibilityService::HIDDEN_STATUS;

        ContentVisibilityService::restorePost(10);

        $this->assertSame('publish', $GLOBALS['__wp_posts'][10]->post_status);
    }

    /**
     * Leaving the meta behind would make a later restore claim a hide that
     * never happened.
     */
    public function testAFailedHideLeavesNoRecordOfItself(): void
    {
        $this->seedPost(10, 'publish');
        $GLOBALS['__wp_update_post_error'] = true;

        $this->assertFalse(ContentVisibilityService::hidePost(10));
        $this->assertArrayNotHasKey(ContentVisibilityService::PREV_STATUS_META, $GLOBALS['__wp_post_meta'][10] ?? []);
    }

    public function testAFailedRestoreKeepsTheRememberedStatus(): void
    {
        $this->seedPost(10, 'draft');
        ContentVisibilityService::hidePost(10);

        $GLOBALS['__wp_update_post_error'] = true;

        $this->assertFalse(ContentVisibilityService::restorePost(10));
        $this->assertSame('draft', $GLOBALS['__wp_post_meta'][10][ContentVisibilityService::PREV_STATUS_META]);
    }

    // -----------------------------------------------------------------------
    // Hiding and restoring a comment
    // -----------------------------------------------------------------------

    public function testHidingACommentHoldsItAndRemembersItWasApproved(): void
    {
        $this->seedComment(20, approved: '1');

        $this->assertTrue(ContentVisibilityService::hideComment(20));

        $this->assertSame('0', $GLOBALS['__wp_comments'][20]->comment_approved);
        $this->assertSame('1', $GLOBALS['__wp_comment_meta'][20][ContentVisibilityService::PREV_STATUS_META]);
    }

    public function testRestoringAnApprovedCommentApprovesItAgain(): void
    {
        $this->seedComment(20, approved: '1');
        ContentVisibilityService::hideComment(20);

        $this->assertTrue(ContentVisibilityService::restoreComment(20));

        $this->assertSame('1', $GLOBALS['__wp_comments'][20]->comment_approved);
        $this->assertArrayNotHasKey(ContentVisibilityService::PREV_STATUS_META, $GLOBALS['__wp_comment_meta'][20]);
    }

    /**
     * A comment that was still awaiting approval when it got reported goes back
     * to awaiting approval, not to approved.
     */
    public function testACommentThatWasAwaitingApprovalGoesBackToAwaitingIt(): void
    {
        $this->seedComment(20, approved: '0');
        ContentVisibilityService::hideComment(20);

        $this->assertTrue(ContentVisibilityService::restoreComment(20));
        $this->assertSame('0', $GLOBALS['__wp_comments'][20]->comment_approved);
    }

    /**
     * Being held is not the same as having been taken down. A site that
     * moderates every new comment holds them all, and those must not be given a
     * "removed by a moderator" tombstone.
     */
    public function testACommentHeldForOrdinaryModerationIsNotConsideredHidden(): void
    {
        $this->seedComment(20, approved: '0');

        $this->assertFalse(ContentVisibilityService::isCommentHidden(20));
    }

    public function testAnApprovedCommentIsNotHidden(): void
    {
        $this->seedComment(20, approved: '1');

        $this->assertFalse(ContentVisibilityService::isCommentHidden(20));
    }

    public function testACommentIsRecognisedFromItsRowWithoutRefetchingIt(): void
    {
        $comment = $this->seedComment(20, approved: '1');
        ContentVisibilityService::hideComment(20);

        $this->assertTrue(ContentVisibilityService::isCommentHidden($comment));
    }

    public function testACommentThatIsNotThereIsNotHidden(): void
    {
        $this->assertFalse(ContentVisibilityService::isCommentHidden(404));
        $this->assertFalse(ContentVisibilityService::hideComment(404));
        $this->assertFalse(ContentVisibilityService::restoreComment(404));
    }

    public function testHidingACommentTwiceChangesNothing(): void
    {
        $this->seedComment(20, approved: '1');
        ContentVisibilityService::hideComment(20);

        $this->assertFalse(ContentVisibilityService::hideComment(20));
        $this->assertSame('1', $GLOBALS['__wp_comment_meta'][20][ContentVisibilityService::PREV_STATUS_META]);
    }

    public function testAFailedCommentHideLeavesNoRecordOfItself(): void
    {
        $this->seedComment(20, approved: '1');
        $GLOBALS['__wp_set_comment_status_fails'] = true;

        $this->assertFalse(ContentVisibilityService::hideComment(20));
        $this->assertArrayNotHasKey(ContentVisibilityService::PREV_STATUS_META, $GLOBALS['__wp_comment_meta'][20] ?? []);
    }

    // -----------------------------------------------------------------------
    // What a thread renders
    // -----------------------------------------------------------------------

    /**
     * Hidden comments are kept rather than dropped so the thread keeps its
     * shape: removing a node from the middle orphans every reply beneath it.
     */
    public function testAThreadKeepsItsHiddenCommentsSoItsShapeSurvives(): void
    {
        $approved = $this->seedComment(20, approved: '1');
        $reported = $this->seedComment(21, approved: '1');
        ContentVisibilityService::hideComment(21);

        $visible = ContentVisibilityService::filterVisibleComments([$approved, $reported]);

        $this->assertSame([$approved, $reported], $visible);
    }

    public function testACommentAwaitingAFirstLookStaysOutOfTheThread(): void
    {
        $approved = $this->seedComment(20, approved: '1');
        $pending = $this->seedComment(21, approved: '0');

        $this->assertSame([$approved], ContentVisibilityService::filterVisibleComments([$approved, $pending]));
    }

    public function testSpamIsNotRendered(): void
    {
        $spam = $this->seedComment(21, approved: 'spam');

        $this->assertSame([], ContentVisibilityService::filterVisibleComments([$spam]));
    }

    /**
     * get_comments() answers ids or counts when asked with the wrong arguments;
     * one of those must not be formatted as a comment.
     */
    public function testAnythingThatIsNotACommentIsDropped(): void
    {
        $approved = $this->seedComment(20, approved: '1');

        $this->assertSame([$approved], ContentVisibilityService::filterVisibleComments([$approved, 21, null, 'x']));
    }

    public function testTheFilteredListIsRenumberedFromZero(): void
    {
        $pending = $this->seedComment(20, approved: '0');
        $approved = $this->seedComment(21, approved: '1');

        $this->assertSame([0], array_keys(ContentVisibilityService::filterVisibleComments([$pending, $approved])));
    }

    /**
     * A marker rather than an empty bubble: the reader is owed the fact that
     * something was there, which is also what keeps the reply beneath it
     * readable.
     */
    public function testAHiddenCommentIsReplacedByAMarkerRatherThanNothing(): void
    {
        $this->assertNotSame('', trim(strip_tags(ContentVisibilityService::tombstone())));
    }

    // -----------------------------------------------------------------------
    // Dispatch by target type
    // -----------------------------------------------------------------------

    public function testTheReportQueueReachesCommentsThroughTheSharedEntryPoints(): void
    {
        $this->seedComment(20, approved: '1');

        $this->assertTrue(ContentVisibilityService::hide(ReportService::TARGET_COMMENT, 20));
        $this->assertTrue(ContentVisibilityService::isHidden(ReportService::TARGET_COMMENT, 20));
        $this->assertTrue(ContentVisibilityService::restore(ReportService::TARGET_COMMENT, 20));
        $this->assertFalse(ContentVisibilityService::isHidden(ReportService::TARGET_COMMENT, 20));
    }

    public function testTheReportQueueReachesTopicsThroughTheSharedEntryPoints(): void
    {
        $this->seedPost(10, 'publish');

        $this->assertTrue(ContentVisibilityService::hide(ReportService::TARGET_POST, 10));
        $this->assertTrue(ContentVisibilityService::isHidden(ReportService::TARGET_POST, 10));
        $this->assertTrue(ContentVisibilityService::restore(ReportService::TARGET_POST, 10));
        $this->assertFalse(ContentVisibilityService::isHidden(ReportService::TARGET_POST, 10));
    }

    // -----------------------------------------------------------------------
    // The post status itself
    // -----------------------------------------------------------------------

    /**
     * Non-public is what keeps a hidden topic out of every WP_Query that did
     * not ask for it by name — the portal's listings, the sitemap, search.
     */
    public function testTheHiddenStatusIsRegisteredAsNonPublicAndUnsearchable(): void
    {
        ContentVisibilityService::registerPostStatus();

        $registered = $GLOBALS['__wp_post_statuses'][ContentVisibilityService::HIDDEN_STATUS];

        $this->assertFalse($registered['public']);
        $this->assertTrue($registered['exclude_from_search']);
        $this->assertFalse($registered['show_in_admin_all_list']);
    }

    // -----------------------------------------------------------------------
    // Helpers
    // -----------------------------------------------------------------------

    private function asModerator(): void
    {
        $GLOBALS['__wp_current_user_id'] = self::MODERATOR;
        $GLOBALS['__wp_caps'] = [Capabilities::MODERATE->value => true];
    }

    private function asMember(int $userId): void
    {
        $GLOBALS['__wp_current_user_id'] = $userId;
        $GLOBALS['__wp_caps'] = [];
    }

    private function seedPost(int $postId, string $status): WP_Post
    {
        $post = new WP_Post();
        $post->ID = $postId;
        $post->post_status = $status;
        $post->post_author = self::AUTHOR;

        $GLOBALS['__wp_posts'][$postId] = $post;

        return $post;
    }

    private function seedComment(int $commentId, string $approved): WP_Comment
    {
        $comment = new WP_Comment();
        $comment->comment_ID = $commentId;
        $comment->comment_approved = $approved;
        $comment->user_id = self::AUTHOR;

        $GLOBALS['__wp_comments'][$commentId] = $comment;

        return $comment;
    }
}
