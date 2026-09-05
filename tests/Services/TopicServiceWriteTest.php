<?php

namespace BitApps\BitConnect\Tests\Services;

use BitApps\BitConnect\Enum\Taxonomies;
use BitApps\BitConnect\Services\TopicService;
use PHPUnit\Framework\TestCase;
use WP_Comment;
use WP_Post;

/**
 * Creating, editing and deleting a topic.
 *
 * The rule this file exists for is the permalink: once a topic has a slug, only
 * an explicit new one replaces it. Renaming the title used to re-mint the slug,
 * which broke every link already pointing at the topic — no error, no redirect,
 * just a forum whose old URLs stopped resolving.
 *
 * Pinning and locking sit beside it because both call wp_update_post() without
 * a word of the topic changing, which is exactly why post_modified cannot
 * answer "was this edited" and the attribution meta has to be written
 * deliberately.
 *
 * @internal
 *
 * @coversNothing
 */
final class TopicServiceWriteTest extends TestCase
{
    private const AUTHOR = 7;

    private const EDITOR = 3;

    private TopicService $topics;

    protected function setUp(): void
    {
        $this->topics = new TopicService();

        $GLOBALS['__wp_posts'] = [];
        $GLOBALS['__wp_comments'] = [];
        $GLOBALS['__wp_post_meta'] = [];
        $GLOBALS['__wp_post_terms'] = [];
        $GLOBALS['__wp_terms'] = [];
        $GLOBALS['__wp_options'] = [];
        $GLOBALS['__wp_users'] = [];
        $GLOBALS['__wp_user_meta'] = [];
        $GLOBALS['__wp_deleted_posts'] = [];
        $GLOBALS['__wp_transients'] = [];
        $GLOBALS['__bc_votes'] = [];
        $GLOBALS['__bc_follows'] = [];
        $GLOBALS['__wp_current_user_id'] = self::EDITOR;
        $GLOBALS['__wp_current_time'] = '2026-08-27 09:30:00';

        unset($GLOBALS['__wp_update_post_error'], $GLOBALS['__wp_insert_post_error']);
    }

    protected function tearDown(): void
    {
        $GLOBALS['__wp_posts'] = [];
        $GLOBALS['__wp_comments'] = [];
        $GLOBALS['__wp_current_user_id'] = 0;

        unset($GLOBALS['__wp_current_time']);
    }

    // -----------------------------------------------------------------------
    // Creating
    // -----------------------------------------------------------------------

    public function testANewTopicTakesItsSlugFromItsTitle(): void
    {
        $created = $this->topics->createTopic(['post_title' => 'Cannot Log In', 'post_content' => 'Body']);

        $this->assertSame('cannot-log-in', $created['post_name']);
        $this->assertSame('bit-connect', $created['post_type']);
    }

    public function testANewTopicMayBeGivenASlugOfItsOwn(): void
    {
        $created = $this->topics->createTopic([
            'post_name'  => 'Login Trouble',
            'post_title' => 'Cannot Log In',
        ]);

        $this->assertSame('login-trouble', $created['post_name']);
    }

    public function testANewTopicIsPublishedUnlessToldOtherwise(): void
    {
        $this->assertSame('publish', $this->topics->createTopic(['post_title' => 'Hello'])['post_status']);
        $this->assertSame('draft', $this->topics->createTopic(['post_status' => 'draft', 'post_title' => 'Hello'])['post_status']);
    }

    public function testANewTopicBelongsToWhoeverIsSignedIn(): void
    {
        $this->assertSame(self::EDITOR, $this->topics->createTopic(['post_title' => 'Hello'])['post_author']);
    }

    public function testANewTopicMayBeAttributedToSomeoneElseExplicitly(): void
    {
        $this->assertSame(self::AUTHOR, $this->topics->createTopic(['post_title' => 'Hello'], self::AUTHOR)['post_author']);
    }

    public function testANewTopicIsFiledUnderTheTermsItWasGiven(): void
    {
        $created = $this->topics->createTopic([
            'departments' => [11],
            'post_title'  => 'Hello',
            'stages'      => [12],
            'tags'        => [13, 14],
            'topic_types' => [10],
        ]);

        $filed = $GLOBALS['__wp_post_terms'][$created['ID']];

        $this->assertSame([10], $filed[Taxonomies::TOPIC_TYPES->value]);
        $this->assertSame([11], $filed[Taxonomies::DEPARTMENTS->value]);
        $this->assertSame([12], $filed[Taxonomies::STAGES->value]);
        $this->assertSame([13, 14], $filed[Taxonomies::TAGS->value]);
    }

    public function testANewTopicAdoptsTheFilesUploadedWithIt(): void
    {
        $this->seedAttachment(90);

        $created = $this->topics->createTopic(['attachments' => [90], 'post_title' => 'Hello']);

        $this->assertSame($created['ID'], $GLOBALS['__wp_posts'][90]->post_parent);
    }

    public function testATopicThatCouldNotBeCreatedIsReportedAsNothing(): void
    {
        $GLOBALS['__wp_insert_post_error'] = true;

        $this->assertNull($this->topics->createTopic(['post_title' => 'Hello']));
    }

    // -----------------------------------------------------------------------
    // The permalink
    // -----------------------------------------------------------------------

    /**
     * The rule the whole file exists for: renaming the title used to silently
     * re-mint the slug and break every link already pointing at the topic.
     */
    public function testRenamingATopicLeavesItsPermalinkAlone(): void
    {
        $this->seedTopic(20, ['post_name' => 'cannot-log-in', 'post_title' => 'Cannot log in']);

        $updated = $this->topics->updateTopic(20, ['post_title' => 'Login fails on Safari']);

        $this->assertSame('cannot-log-in', $updated['post_name']);
    }

    public function testAnExplicitSlugDoesReplaceThePermalink(): void
    {
        $this->seedTopic(20, ['post_name' => 'cannot-log-in']);

        $updated = $this->topics->updateTopic(20, ['post_name' => 'Login Fails On Safari']);

        $this->assertSame('login-fails-on-safari', $updated['post_name']);
    }

    /**
     * A topic that somehow has no slug still needs one, and the title is the
     * only thing to build it from.
     */
    public function testATopicWithNoSlugYetGetsOneFromItsTitle(): void
    {
        $this->seedTopic(20, ['post_name' => '', 'post_title' => 'Cannot log in']);

        $this->assertSame('cannot-log-in', $this->topics->updateTopic(20, [])['post_name']);
    }

    /**
     * A slug with nothing sluggable in it is not a slug, and must not blank the
     * permalink.
     */
    public function testASlugThatSanitizesToNothingIsIgnored(): void
    {
        $this->seedTopic(20, ['post_name' => 'cannot-log-in']);

        $this->assertSame('cannot-log-in', $this->topics->updateTopic(20, ['post_name' => '!!!'])['post_name']);
    }

    // -----------------------------------------------------------------------
    // Editing the words
    // -----------------------------------------------------------------------

    public function testEditingTheWordsRecordsWhoDidItAndWhen(): void
    {
        $this->seedTopic(20, ['post_content' => 'Body', 'post_title' => 'Cannot log in']);

        $this->topics->updateTopic(20, ['post_content' => 'Rewritten body']);

        $this->assertSame('2026-08-27 09:30:00', $GLOBALS['__wp_post_meta'][20]['_bc_edited_at']);
        $this->assertSame(self::EDITOR, $GLOBALS['__wp_post_meta'][20]['_bc_edited_by']);
    }

    /**
     * Both call wp_update_post() and bump post_modified without a word
     * changing, which is why that column cannot answer this.
     */
    public function testPinningATopicIsNotAnEdit(): void
    {
        $this->seedTopic(20, ['post_title' => 'Cannot log in']);

        $this->topics->updateTopic(20, ['is_pinned' => true]);

        $this->assertSame([], $GLOBALS['__wp_post_meta'][20] ?? []);
    }

    public function testLockingATopicIsNotAnEdit(): void
    {
        $this->seedTopic(20, ['post_title' => 'Cannot log in']);

        $this->topics->updateTopic(20, ['is_locked' => true]);

        $this->assertSame([], $GLOBALS['__wp_post_meta'][20] ?? []);
    }

    public function testResendingTheSameWordsIsNotAnEdit(): void
    {
        $this->seedTopic(20, ['post_content' => 'Body', 'post_title' => 'Cannot log in']);

        $this->topics->updateTopic(20, ['post_content' => 'Body', 'post_title' => 'Cannot log in']);

        $this->assertSame([], $GLOBALS['__wp_post_meta'][20] ?? []);
    }

    // -----------------------------------------------------------------------
    // Pinning and locking
    // -----------------------------------------------------------------------

    public function testPinningPutsTheTopicOnTheStickyList(): void
    {
        $this->seedTopic(20, []);

        $this->assertTrue($this->topics->updateTopic(20, ['is_pinned' => true])['is_pinned']);
        $this->assertSame([20], get_option('sticky_posts', []));
    }

    public function testPinningATopicTwiceListsItOnce(): void
    {
        $this->seedTopic(20, []);

        $this->topics->updateTopic(20, ['is_pinned' => true]);
        $this->topics->updateTopic(20, ['is_pinned' => true]);

        $this->assertSame([20], get_option('sticky_posts', []));
    }

    public function testUnpinningTakesItOffAgainAndLeavesTheOthers(): void
    {
        $this->seedTopic(20, []);
        $this->seedTopic(21, []);

        $this->topics->updateTopic(20, ['is_pinned' => true]);
        $this->topics->updateTopic(21, ['is_pinned' => true]);
        $this->topics->updateTopic(20, ['is_pinned' => false]);

        $this->assertSame([21], get_option('sticky_posts', []));
    }

    public function testLockingClosesCommentsAndUnlockingOpensThem(): void
    {
        $this->seedTopic(20, ['comment_status' => 'open']);

        $this->topics->updateTopic(20, ['is_locked' => true]);
        $this->assertSame('closed', $GLOBALS['__wp_posts'][20]->comment_status);

        $this->topics->updateTopic(20, ['is_locked' => false]);
        $this->assertSame('open', $GLOBALS['__wp_posts'][20]->comment_status);
    }

    public function testAnUpdateThatSaysNothingAboutPinningLeavesItAlone(): void
    {
        $this->seedTopic(20, []);
        $this->topics->updateTopic(20, ['is_pinned' => true]);

        $this->topics->updateTopic(20, ['post_title' => 'Renamed']);

        $this->assertSame([20], get_option('sticky_posts', []));
    }

    // -----------------------------------------------------------------------
    // Attachments
    // -----------------------------------------------------------------------

    /**
     * A file the author removed from the topic is unlinked rather than deleted:
     * it may be in use elsewhere, and the media library is not this service's
     * to prune.
     */
    public function testAFileRemovedFromATopicIsUnlinkedFromIt(): void
    {
        $this->seedTopic(20, []);
        $this->seedAttachment(90, 20);
        $this->seedAttachment(91, 20);

        $this->topics->updateTopic(20, ['attachments' => [91]]);

        $this->assertSame(0, $GLOBALS['__wp_posts'][90]->post_parent);
        $this->assertSame(20, $GLOBALS['__wp_posts'][91]->post_parent);
    }

    public function testAFileAddedToATopicIsLinkedToIt(): void
    {
        $this->seedTopic(20, []);
        $this->seedAttachment(90);

        $this->topics->updateTopic(20, ['attachments' => [90]]);

        $this->assertSame(20, $GLOBALS['__wp_posts'][90]->post_parent);
    }

    public function testAnUpdateThatSaysNothingAboutFilesLeavesThemAlone(): void
    {
        $this->seedTopic(20, []);
        $this->seedAttachment(90, 20);

        $this->topics->updateTopic(20, ['post_title' => 'Renamed']);

        $this->assertSame(20, $GLOBALS['__wp_posts'][90]->post_parent);
    }

    // -----------------------------------------------------------------------
    // What cannot be edited
    // -----------------------------------------------------------------------

    public function testATopicThatIsNotThereCannotBeEdited(): void
    {
        $this->assertNull($this->topics->updateTopic(404, ['post_title' => 'Hello']));
    }

    /**
     * A page or another plugin's post is not a forum topic, however plausible
     * the id looks.
     */
    public function testSomethingThatIsNotATopicCannotBeEdited(): void
    {
        $page = new WP_Post();
        $page->ID = 900;
        $page->post_type = 'page';
        $GLOBALS['__wp_posts'][900] = $page;

        $this->assertNull($this->topics->updateTopic(900, ['post_title' => 'Hello']));
    }

    public function testAnUpdateThatCouldNotBeWrittenIsReportedAsNothing(): void
    {
        $this->seedTopic(20, []);
        $GLOBALS['__wp_update_post_error'] = true;

        $this->assertNull($this->topics->updateTopic(20, ['post_title' => 'Hello']));
    }

    // -----------------------------------------------------------------------
    // Deleting
    // -----------------------------------------------------------------------

    /**
     * Left behind, a deleted topic's votes keep counting towards totals that
     * point at nothing.
     */
    public function testDeletingATopicTakesItsVotesWithIt(): void
    {
        $this->seedTopic(20, []);
        $GLOBALS['__bc_votes'] = [['user_id' => 3, 'post_id' => 20, 'comment_id' => null]];

        $this->assertTrue($this->topics->deleteTopic(20));
        $this->assertSame([], $GLOBALS['__bc_votes']);
    }

    public function testDeletingATopicTakesTheVotesOnItsRepliesToo(): void
    {
        $this->seedTopic(20, []);
        $this->seedComment(50, 20);
        $GLOBALS['__bc_votes'] = [
            ['user_id' => 3, 'post_id' => null, 'comment_id' => 50],
            ['user_id' => 4, 'post_id' => null, 'comment_id' => 99],
        ];

        $this->topics->deleteTopic(20);

        $this->assertSame([['user_id' => 4, 'post_id' => null, 'comment_id' => 99]], $GLOBALS['__bc_votes']);
    }

    /**
     * Deleted rather than trashed: a topic a moderator removed must not sit in
     * the trash where the portal's own queries can still reach it.
     */
    public function testATopicIsDeletedOutrightRatherThanTrashed(): void
    {
        $this->seedTopic(20, []);

        $this->topics->deleteTopic(20);

        $this->assertSame([['id' => 20, 'force' => true]], $GLOBALS['__wp_deleted_posts']);
    }

    public function testDeletingSomethingThatIsNotATopicDoesNothing(): void
    {
        $page = new WP_Post();
        $page->ID = 900;
        $page->post_type = 'page';
        $GLOBALS['__wp_posts'][900] = $page;

        $this->assertFalse($this->topics->deleteTopic(900));
        $this->assertFalse($this->topics->deleteTopic(404));
        $this->assertArrayHasKey(900, $GLOBALS['__wp_posts']);
    }

    // -----------------------------------------------------------------------
    // Helpers
    // -----------------------------------------------------------------------

    /**
     * @param array<string, mixed> $fields
     */
    private function seedTopic(int $postId, array $fields): void
    {
        $post = new WP_Post();
        $post->ID = $postId;
        $post->post_type = 'bit-connect';
        $post->post_author = self::AUTHOR;
        $post->post_status = 'publish';
        $post->post_title = 'Cannot log in';
        $post->post_content = 'Body';
        $post->post_excerpt = '';
        $post->post_name = 'cannot-log-in';
        $post->comment_status = 'open';
        $post->post_parent = 0;

        foreach ($fields as $field => $value) {
            $post->{$field} = $value;
        }

        $GLOBALS['__wp_posts'][$postId] = $post;
    }

    private function seedAttachment(int $attachmentId, int $parentId = 0): void
    {
        $attachment = new WP_Post();
        $attachment->ID = $attachmentId;
        $attachment->post_type = 'attachment';
        $attachment->post_parent = $parentId;
        $attachment->post_mime_type = 'image/png';
        $attachment->guid = 'https://example.com/uploads/' . $attachmentId . '.png';

        $GLOBALS['__wp_posts'][$attachmentId] = $attachment;
    }

    private function seedComment(int $commentId, int $postId): void
    {
        $comment = new WP_Comment();
        $comment->comment_ID = $commentId;
        $comment->comment_post_ID = $postId;
        $comment->user_id = self::AUTHOR;
        $comment->comment_approved = '1';

        $GLOBALS['__wp_comments'][$commentId] = $comment;
    }
}
