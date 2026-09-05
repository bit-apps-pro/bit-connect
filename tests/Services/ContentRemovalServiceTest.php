<?php

namespace BitApps\BitConnect\Tests\Services;

use BitApps\BitConnect\Services\ContentRemovalService;
use BitApps\BitConnect\Services\ReportService;
use PHPUnit\Framework\TestCase;
use WP_Comment;
use WP_Post;

/**
 * Pins down what goes when a reply is deleted, and what is read out first.
 *
 * Deleting used to happen by two separate routes — the report queue and the
 * portal's own buttons — and what has to hold in both is the same: a comment's
 * replies go with it rather than being orphaned, and what was there is captured
 * while it still exists so the activity log has something to show once the row
 * is gone.
 *
 * @internal
 *
 * @coversNothing
 */
final class ContentRemovalServiceTest extends TestCase
{
    protected function tearDown(): void
    {
        $GLOBALS['__wp_posts'] = [];
        $GLOBALS['__wp_comments'] = [];
        $GLOBALS['__wp_deleted_comments'] = [];
    }

    // -----------------------------------------------------------------------
    // Reading out what was there
    // -----------------------------------------------------------------------

    public function testATopicIsDescribedByItsTitleAndBody(): void
    {
        $this->seedPost(10, 'Cannot log in', 'It says my password is wrong.');

        $described = ContentRemovalService::describe(ReportService::TARGET_POST, 10);

        $this->assertSame('Cannot log in', $described['post_title']);
        $this->assertSame('It says my password is wrong.', $described['post_content']);
    }

    public function testACommentIsDescribedByItsBodyAndWhereItLived(): void
    {
        $this->seedComment(20, 'Same here.', postId: 10);

        $described = ContentRemovalService::describe(ReportService::TARGET_COMMENT, 20);

        $this->assertSame('Same here.', $described['content']);
        $this->assertSame(10, $described['post']);
    }

    /**
     * The count is what tells a moderator, after the fact, that deleting one
     * reply took a subtree with it.
     */
    public function testACommentReportsHowManyRepliesGoWithIt(): void
    {
        $this->seedComment(20, 'Same here.', postId: 10);
        $this->seedComment(21, 'Me too.', postId: 10, parentId: 20);
        $this->seedComment(22, 'And me.', postId: 10, parentId: 20);

        $this->assertSame(2, ContentRemovalService::describe(ReportService::TARGET_COMMENT, 20)['replies_lost']);
    }

    public function testALeafCommentReportsNoRepliesLost(): void
    {
        $this->seedComment(20, 'Same here.', postId: 10);

        $this->assertSame(0, ContentRemovalService::describe(ReportService::TARGET_COMMENT, 20)['replies_lost']);
    }

    public function testTextLongEnoughToGrowTheTableIsExcerpted(): void
    {
        $this->seedPost(10, 'Long one', str_repeat('a', 2500));

        $described = ContentRemovalService::describe(ReportService::TARGET_POST, 10);

        $this->assertSame(str_repeat('a', 2000) . '… [truncated]', $described['post_content']);
    }

    public function testSomethingAlreadyGoneIsDescribedAsNothing(): void
    {
        $this->assertSame([], ContentRemovalService::describe(ReportService::TARGET_POST, 404));
        $this->assertSame([], ContentRemovalService::describe(ReportService::TARGET_COMMENT, 404));
    }

    // -----------------------------------------------------------------------
    // Removing
    // -----------------------------------------------------------------------

    /**
     * Replies are deleted rather than reparented: a reply to something that is
     * gone answers a question the reader cannot see.
     */
    public function testDeletingACommentTakesItsRepliesWithIt(): void
    {
        $this->seedComment(20, 'Same here.', postId: 10);
        $this->seedComment(21, 'Me too.', postId: 10, parentId: 20);

        $this->assertTrue(ContentRemovalService::remove(ReportService::TARGET_COMMENT, 20));

        $this->assertArrayNotHasKey(20, $GLOBALS['__wp_comments']);
        $this->assertArrayNotHasKey(21, $GLOBALS['__wp_comments']);
    }

    public function testARepliesSiblingElsewhereInTheThreadIsLeftAlone(): void
    {
        $this->seedComment(20, 'Same here.', postId: 10);
        $this->seedComment(21, 'Me too.', postId: 10, parentId: 20);
        $this->seedComment(30, 'Unrelated.', postId: 10);

        ContentRemovalService::remove(ReportService::TARGET_COMMENT, 20);

        $this->assertArrayHasKey(30, $GLOBALS['__wp_comments']);
    }

    /**
     * Deleted rather than trashed: content taken down by a moderator must not
     * sit in the trash where the portal's own queries can still reach it.
     */
    public function testCommentsAreDeletedOutrightRatherThanTrashed(): void
    {
        $this->seedComment(20, 'Same here.', postId: 10);

        ContentRemovalService::remove(ReportService::TARGET_COMMENT, 20);

        $this->assertSame([['id' => 20, 'force' => true]], $GLOBALS['__wp_deleted_comments']);
    }

    public function testDeletingACommentThatIsAlreadyGoneReportsFailureRatherThanSuccess(): void
    {
        $this->assertFalse(ContentRemovalService::remove(ReportService::TARGET_COMMENT, 404));
        $this->assertSame([], $GLOBALS['__wp_deleted_comments'] ?? []);
    }

    // -----------------------------------------------------------------------
    // Helpers
    // -----------------------------------------------------------------------

    private function seedPost(int $postId, string $title, string $content): void
    {
        $post = new WP_Post();
        $post->ID = $postId;
        $post->post_title = $title;
        $post->post_content = $content;
        $post->post_author = 3;

        $GLOBALS['__wp_posts'][$postId] = $post;
    }

    private function seedComment(int $commentId, string $content, int $postId, int $parentId = 0): void
    {
        $comment = new WP_Comment();
        $comment->comment_ID = $commentId;
        $comment->comment_content = $content;
        $comment->comment_post_ID = $postId;
        $comment->comment_parent = $parentId;
        $comment->user_id = 3;

        $GLOBALS['__wp_comments'][$commentId] = $comment;
    }
}
