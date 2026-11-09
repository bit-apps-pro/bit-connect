<?php

namespace BitApps\BitConnect\Tests\Services;

use BitApps\BitConnect\Services\Events\CommentPublication;
use BitApps\BitConnect\Services\Events\EventPayload;
use BitApps\BitConnect\Services\Events\EventRegistry;
use BitApps\BitConnect\Services\Events\Events;
use BitApps\BitConnect\Services\Events\TopicPublication;
use PHPUnit\Framework\TestCase;
use WP_Comment;
use WP_Post;
use WP_User;

/**
 * The events about what happens to a post or a comment after it is public —
 * edited, deleted — and the rule that holds them together: listeners hear
 * only about content they were told exists.
 *
 * @internal
 *
 * @coversNothing
 */
final class EventsLifecycleTest extends TestCase
{
    private const TOPIC = 42;

    private const COMMENT = 128;

    private const AUTHOR = 5;

    private const ACTOR = 9;

    protected function setUp(): void
    {
        $GLOBALS['__wp_actions_fired'] = [];
        $GLOBALS['__wp_filters'] = [];
        $GLOBALS['__wp_post_meta'] = [];
        $GLOBALS['__wp_comment_meta'] = [];
        $GLOBALS['__wp_comments'] = [];
        $GLOBALS['__wp_current_user_id'] = self::ACTOR;
        $GLOBALS['__wp_users'] = [
            self::AUTHOR => $this->user(self::AUTHOR, 'jane'),
            self::ACTOR  => $this->user(self::ACTOR, 'mod'),
        ];
        $GLOBALS['__wp_posts'] = [self::TOPIC => $this->topic()];

        EventRegistry::flush();
    }

    protected function tearDown(): void
    {
        $GLOBALS['__wp_actions_fired'] = [];
        $GLOBALS['__wp_filters'] = [];
        $GLOBALS['__wp_post_meta'] = [];
        $GLOBALS['__wp_comment_meta'] = [];
        $GLOBALS['__wp_comments'] = [];
        $GLOBALS['__wp_users'] = [];
        $GLOBALS['__wp_posts'] = [];
        $GLOBALS['__wp_current_user_id'] = 0;

        EventRegistry::flush();
    }

    public function testAnApprovedCommentIsAnnouncedAtOnce(): void
    {
        CommentPublication::created($this->comment('1'), $this->topic());

        self::assertSame(['bit_connect_comment_created', 'bit_connect_event'], array_column($this->fired(), 'tag'));
    }

    public function testAHeldCommentWaitsForItsApproval(): void
    {
        $held = $this->comment('0');
        CommentPublication::created($held, $this->topic());

        self::assertSame([], $this->fired());
        self::assertFalse(CommentPublication::isAnnounced($held));

        $GLOBALS['__wp_comments'][self::COMMENT] = $this->comment('1');
        CommentPublication::onTransition('approved', 'unapproved', $this->comment('1'));

        self::assertSame('bit_connect_comment_created', $this->fired()[0]['tag']);
        self::assertSame('approved', $this->fired()[0]['args'][0]['comment_status']);

        // A second approval, or a hide and restore later, is not a new comment.
        $GLOBALS['__wp_actions_fired'] = [];
        CommentPublication::onTransition('approved', 'unapproved', $this->comment('1'));

        self::assertSame([], $this->fired());
    }

    public function testACommentRestoredAfterAReportIsNotNew(): void
    {
        // Hidden by a report: held, but never marked as waiting.
        CommentPublication::onTransition('approved', 'unapproved', $this->comment('1'));

        self::assertSame([], $this->fired());
    }

    public function testOnlyAnAnnouncedTopicCountsAsKnown(): void
    {
        self::assertFalse(TopicPublication::isAnnounced($this->topic()));

        $GLOBALS['__wp_post_meta'][self::TOPIC][TopicPublication::PUBLISHED_META] = '2026-10-20T09:30:00+00:00';

        self::assertTrue(TopicPublication::isAnnounced($this->topic()));
    }

    public function testAnEditSaysWhatChangedAndWhoChangedIt(): void
    {
        Events::topicUpdated($this->topic(), ['title', 'tags']);

        $payload = $this->fired()[0]['args'][0];

        self::assertSame('bit_connect_topic_updated', $this->fired()[0]['tag']);
        self::assertSame('title,tags', $payload['changed']);
        self::assertSame(self::AUTHOR, $payload['author_id']);
        self::assertSame(self::ACTOR, $payload['actor_id']);
    }

    public function testADeletedTopicIsDescribedFromBeforeTheDelete(): void
    {
        $snapshot = EventPayload::topic($this->topic());
        unset($GLOBALS['__wp_posts'][self::TOPIC]);

        Events::topicDeleted($snapshot, self::AUTHOR);

        $payload = $this->fired()[0]['args'][0];

        self::assertSame('bit_connect_topic_deleted', $this->fired()[0]['tag']);
        self::assertSame(self::TOPIC, $payload['topic_id']);
        self::assertSame('Export failed', $payload['topic_title']);
        self::assertSame(self::ACTOR, $payload['actor_id']);
    }

    public function testADeletedCommentSaysHowManyRepliesWentWithIt(): void
    {
        $snapshot = EventPayload::comment($this->comment('1')) + EventPayload::topic($this->topic());

        Events::commentDeleted($snapshot, self::AUTHOR, 3);

        $payload = $this->fired()[0]['args'][0];

        self::assertSame('bit_connect_comment_deleted', $this->fired()[0]['tag']);
        self::assertSame(self::COMMENT, $payload['comment_id']);
        self::assertSame(3, $payload['replies_deleted']);
    }

    public function testAFollowNamesWhatWasFollowed(): void
    {
        Events::followed(self::ACTOR, 'topic', self::TOPIC);

        $payload = $this->fired()[0]['args'][0];

        self::assertSame('bit_connect_followed', $this->fired()[0]['tag']);
        self::assertSame('topic', $payload['follow_target_type']);
        self::assertSame('Export failed', $payload['follow_target_name']);
        self::assertSame(self::ACTOR, $payload['member_id']);
    }

    public function testAProfileChangeSaysWhichFieldsChanged(): void
    {
        Events::profileUpdated(self::AUTHOR, ['display_name', 'avatar']);

        $payload = $this->fired()[0]['args'][0];

        self::assertSame('bit_connect_profile_updated', $this->fired()[0]['tag']);
        self::assertSame('display_name,avatar', $payload['changed']);
        self::assertSame(self::AUTHOR, $payload['member_id']);
    }

    public function testEveryNewPayloadCarriesTheFieldsItsExampleShows(): void
    {
        $snapshot = EventPayload::topic($this->topic());
        $commentSnapshot = EventPayload::comment($this->comment('1')) + $snapshot;

        Events::topicUpdated($this->topic(), ['title']);
        Events::topicDeleted($snapshot, self::AUTHOR);
        Events::commentUpdated($this->comment('1'), $this->topic());
        Events::commentDeleted($commentSnapshot, self::AUTHOR, 0);
        Events::followed(self::ACTOR, 'topic', self::TOPIC);
        Events::profileUpdated(self::AUTHOR, ['bio']);

        $generic = array_values(array_filter($this->fired(), static fn (array $a): bool => $a['tag'] === 'bit_connect_event'));

        self::assertCount(6, $generic);

        foreach ($generic as $fired) {
            [$event, $payload] = $fired['args'];

            foreach (array_keys(EventRegistry::all()[$event]['fields']) as $field) {
                self::assertArrayHasKey($field, $payload, "{$event} lacks {$field}");
            }
        }
    }

    private function fired(): array
    {
        return array_values(
            array_filter(
                $GLOBALS['__wp_actions_fired'],
                static fn (array $a): bool => str_starts_with($a['tag'], 'bit_connect_')
            )
        );
    }

    private function topic(): WP_Post
    {
        $post = new WP_Post();
        $post->ID = self::TOPIC;
        $post->post_author = self::AUTHOR;
        $post->post_title = 'Export failed';
        $post->post_content = '<p>Export does not work.</p>';
        $post->post_status = 'publish';
        $post->post_type = 'bit-connect';
        $post->post_date_gmt = '2026-10-20 09:30:00';

        return $post;
    }

    private function comment(string $approved): WP_Comment
    {
        $comment = new WP_Comment();
        $comment->comment_ID = self::COMMENT;
        $comment->comment_post_ID = self::TOPIC;
        $comment->comment_parent = 0;
        $comment->user_id = self::ACTOR;
        $comment->comment_content = '<p>Try again.</p>';
        $comment->comment_approved = $approved;
        $comment->comment_date_gmt = '2026-10-20 10:05:00';

        return $comment;
    }

    private function user(int $id, string $login): WP_User
    {
        $user = new WP_User();
        $user->ID = $id;
        $user->user_login = $login;
        $user->display_name = ucfirst($login);
        $user->user_email = $login . '@example.com';
        $user->roles = ['subscriber'];

        return $user;
    }
}
