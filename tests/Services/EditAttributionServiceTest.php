<?php

namespace BitApps\BitConnect\Tests\Services;

use BitApps\BitConnect\Services\EditAttributionService;
use PHPUnit\Framework\TestCase;
use WP_Comment;
use WP_Post;

/**
 * Pins down who a topic or comment reports as its last editor, and when.
 *
 * Two readings come out of the same record: an author editing their own words
 * gets a plain "(edited)", while someone else editing them gets a byline. The
 * portal picks between them on `by_author`, so getting that flag wrong turns a
 * colleague's correction into what looks like a moderator acting against a
 * member.
 *
 * @internal
 *
 * @coversNothing
 */
final class EditAttributionServiceTest extends TestCase
{
    private const NOW = '2026-08-27 09:30:00';

    protected function setUp(): void
    {
        $GLOBALS['__wp_current_time'] = self::NOW;
    }

    protected function tearDown(): void
    {
        unset($GLOBALS['__wp_current_time']);

        $GLOBALS['__wp_posts'] = [];
        $GLOBALS['__wp_comments'] = [];
        $GLOBALS['__wp_post_meta'] = [];
        $GLOBALS['__wp_comment_meta'] = [];
        $GLOBALS['__wp_users'] = [];
        $GLOBALS['__wp_user_meta'] = [];
    }

    // -----------------------------------------------------------------------
    // Nothing to report
    // -----------------------------------------------------------------------

    public function testATopicThatWasNeverEditedReportsNothing(): void
    {
        $this->seedPost(10, authorId: 3);

        $this->assertNull(EditAttributionService::forPost(10));
    }

    public function testACommentThatWasNeverEditedReportsNothing(): void
    {
        $this->seedComment(20, authorId: 3);

        $this->assertNull(EditAttributionService::forComment(20));
    }

    public function testAMissingTopicReportsNothingRatherThanFailing(): void
    {
        $this->assertNull(EditAttributionService::forPost(404));
    }

    public function testAMissingCommentReportsNothingRatherThanFailing(): void
    {
        $this->assertNull(EditAttributionService::forComment(404));
    }

    /**
     * Half a record is no record: a timestamp with no editor behind it cannot
     * be printed either way round.
     */
    public function testARecordMissingItsEditorIsNotReported(): void
    {
        $this->seedPost(10, authorId: 3);
        $GLOBALS['__wp_post_meta'][10]['_bc_edited_at'] = self::NOW;

        $this->assertNull(EditAttributionService::forPost(10));
    }

    public function testARecordMissingItsTimestampIsNotReported(): void
    {
        $this->seedPost(10, authorId: 3);
        $GLOBALS['__wp_post_meta'][10]['_bc_edited_by'] = 3;

        $this->assertNull(EditAttributionService::forPost(10));
    }

    // -----------------------------------------------------------------------
    // Recording an edit
    // -----------------------------------------------------------------------

    public function testAnAuthorEditingTheirOwnTopicIsReportedAsTheAuthor(): void
    {
        $this->seedUser(3, 'Rahim');
        $this->seedPost(10, authorId: 3);

        EditAttributionService::recordPost(10, 3);

        $attribution = EditAttributionService::forPost(10);

        $this->assertSame(self::NOW, $attribution['at']);
        $this->assertSame(3, $attribution['by']);
        $this->assertSame('Rahim', $attribution['by_name']);
        $this->assertTrue($attribution['by_author']);
    }

    public function testATeammateEditingSomeoneElsesTopicIsReportedAsNotTheAuthor(): void
    {
        $this->seedUser(3, 'Rahim');
        $this->seedUser(7, 'Nadia');
        $this->seedPost(10, authorId: 3);

        EditAttributionService::recordPost(10, 7);

        $attribution = EditAttributionService::forPost(10);

        $this->assertSame(7, $attribution['by']);
        $this->assertSame('Nadia', $attribution['by_name']);
        $this->assertFalse($attribution['by_author']);
    }

    public function testACommentEditIsRecordedAgainstTheCommentAuthor(): void
    {
        $this->seedUser(7, 'Nadia');
        $this->seedComment(20, authorId: 3);

        EditAttributionService::recordComment(20, 7);

        $attribution = EditAttributionService::forComment(20);

        $this->assertSame(self::NOW, $attribution['at']);
        $this->assertSame(7, $attribution['by']);
        $this->assertFalse($attribution['by_author']);
    }

    public function testACommentAuthorEditingTheirOwnReplyIsReportedAsTheAuthor(): void
    {
        $this->seedUser(3, 'Rahim');
        $this->seedComment(20, authorId: 3);

        EditAttributionService::recordComment(20, 3);

        $this->assertTrue(EditAttributionService::forComment(20)['by_author']);
    }

    /**
     * The portal falls back to a plain "(edited)" rather than printing
     * "Edited by " and nothing at all.
     */
    public function testADeletedEditorLeavesTheNameEmptyRatherThanTheRecordUnreported(): void
    {
        $this->seedPost(10, authorId: 3);

        EditAttributionService::recordPost(10, 99);

        $attribution = EditAttributionService::forPost(10);

        $this->assertSame(99, $attribution['by']);
        $this->assertSame('', $attribution['by_name']);
        $this->assertSame('', $attribution['by_slug']);
    }

    public function testAnEmptyIdRecordsNothing(): void
    {
        $this->seedPost(10, authorId: 3);

        EditAttributionService::recordPost(0, 7);
        EditAttributionService::recordPost(10, 0);
        EditAttributionService::recordComment(0, 7);
        EditAttributionService::recordComment(20, 0);

        $this->assertSame([], $GLOBALS['__wp_post_meta'][10] ?? []);
        $this->assertSame([], $GLOBALS['__wp_comment_meta'][20] ?? []);
    }

    // -----------------------------------------------------------------------
    // What counts as a content change
    // -----------------------------------------------------------------------

    public function testAChangedTitleCountsAsAnEdit(): void
    {
        $existing = $this->makePost('Original', 'Body', 'Excerpt');

        $this->assertTrue(EditAttributionService::postContentChanged($existing, ['post_title' => 'Rewritten']));
    }

    public function testChangedContentCountsAsAnEdit(): void
    {
        $existing = $this->makePost('Original', 'Body', 'Excerpt');

        $this->assertTrue(EditAttributionService::postContentChanged($existing, ['post_content' => 'Rewritten body']));
    }

    public function testAChangedExcerptCountsAsAnEdit(): void
    {
        $existing = $this->makePost('Original', 'Body', 'Excerpt');

        $this->assertTrue(EditAttributionService::postContentChanged($existing, ['post_excerpt' => 'Rewritten excerpt']));
    }

    /**
     * Pinning or locking a topic calls wp_update_post(), which bumps
     * post_modified without a word of the topic changing. A pinned topic must
     * not come out of it claiming to have been edited.
     */
    public function testPinningOrLockingATopicIsNotAnEdit(): void
    {
        $existing = $this->makePost('Original', 'Body', 'Excerpt');

        $this->assertFalse(EditAttributionService::postContentChanged($existing, ['is_pinned' => true, 'is_locked' => true]));
    }

    public function testResendingTheSameWordsIsNotAnEdit(): void
    {
        $existing = $this->makePost('Original', 'Body', 'Excerpt');

        $unchanged = [
            'post_title'   => 'Original',
            'post_content' => 'Body',
            'post_excerpt' => 'Excerpt',
        ];

        $this->assertFalse(EditAttributionService::postContentChanged($existing, $unchanged));
    }

    public function testAnEmptyUpdateIsNotAnEdit(): void
    {
        $this->assertFalse(EditAttributionService::postContentChanged($this->makePost('Original', 'Body', 'Excerpt'), []));
    }

    /**
     * Clearing an excerpt is a change; an absent key is not the same as an
     * empty one.
     */
    public function testEmptyingAFieldCountsAsAnEdit(): void
    {
        $existing = $this->makePost('Original', 'Body', 'Excerpt');

        $this->assertTrue(EditAttributionService::postContentChanged($existing, ['post_excerpt' => '']));
    }

    // -----------------------------------------------------------------------
    // Helpers
    // -----------------------------------------------------------------------

    private function makePost(string $title, string $content, string $excerpt): WP_Post
    {
        $post = new WP_Post();
        $post->post_title = $title;
        $post->post_content = $content;
        $post->post_excerpt = $excerpt;

        return $post;
    }

    private function seedPost(int $postId, int $authorId): void
    {
        $post = new WP_Post();
        $post->ID = $postId;
        $post->post_author = $authorId;

        $GLOBALS['__wp_posts'][$postId] = $post;
    }

    private function seedComment(int $commentId, int $authorId): void
    {
        $comment = new WP_Comment();
        $comment->user_id = $authorId;

        $GLOBALS['__wp_comments'][$commentId] = $comment;
    }

    private function seedUser(int $userId, string $displayName): void
    {
        $user = new \WP_User();
        $user->ID = $userId;
        $user->display_name = $displayName;
        $user->user_login = strtolower($displayName);

        $GLOBALS['__wp_users'][$userId] = $user;
    }
}
