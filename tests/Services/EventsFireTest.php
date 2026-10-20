<?php

namespace BitApps\BitConnect\Tests\Services;

use BitApps\BitConnect\Enum\ActivityActions;
use BitApps\BitConnect\Enum\Taxonomies;
use BitApps\BitConnect\Services\Events\EventRegistry;
use BitApps\BitConnect\Services\Events\Events;
use BitApps\BitConnect\Services\Events\TopicPublication;
use PHPUnit\Framework\TestCase;
use WP_Comment;
use WP_Post;
use WP_Term;
use WP_User;

/**
 * Each public event fires its own hook, then `bit_connect_event`, with one
 * flat array of scalars.
 *
 * Flat matters more than it looks: an automation plugin offers each payload
 * key as a field to map, and a nested array is a field it cannot offer.
 *
 * @internal
 *
 * @coversNothing
 */
final class EventsFireTest extends TestCase
{
    private const TOPIC = 42;

    private const AUTHOR = 5;

    private const ACTOR = 9;

    protected function setUp(): void
    {
        $GLOBALS['__wp_actions_fired'] = [];
        $GLOBALS['__wp_filters'] = [];
        $GLOBALS['__wp_post_meta'] = [];
        $GLOBALS['__wp_current_user_id'] = self::ACTOR;
        $GLOBALS['__wp_users'] = [
            self::AUTHOR => $this->user(self::AUTHOR, 'jane', 'Jane Doe'),
            self::ACTOR  => $this->user(self::ACTOR, 'mod', 'Mo Derator'),
        ];
        $GLOBALS['__wp_terms'] = [$this->term(7, 'export'), $this->term(9, 'csv')];
        $GLOBALS['__wp_post_terms'] = [self::TOPIC => [Taxonomies::TAGS->value => [7, 9]]];
        $GLOBALS['__wp_posts'] = [self::TOPIC => $this->topic('publish')];

        EventRegistry::flush();
    }

    protected function tearDown(): void
    {
        $GLOBALS['__wp_actions_fired'] = [];
        $GLOBALS['__wp_filters'] = [];
        $GLOBALS['__wp_post_meta'] = [];
        $GLOBALS['__wp_users'] = [];
        $GLOBALS['__wp_terms'] = [];
        $GLOBALS['__wp_post_terms'] = [];
        $GLOBALS['__wp_posts'] = [];
        $GLOBALS['__wp_current_user_id'] = 0;

        EventRegistry::flush();
    }

    public function testTopicCreatedFiresItsHookThenTheGenericOne(): void
    {
        Events::topicCreated($this->topic('publish'));

        $fired = $this->fired();

        self::assertSame(['bit_connect_topic_created', 'bit_connect_event'], array_column($fired, 'tag'));
        self::assertSame('topic_created', $fired[1]['args'][0]);
        self::assertSame($fired[0]['args'][0], $fired[1]['args'][1]);
    }

    public function testThePayloadIsFlat(): void
    {
        Events::topicCreated($this->topic('publish'));

        $payload = $this->fired()[0]['args'][0];

        foreach ($payload as $key => $value) {
            self::assertIsString($key);
            self::assertTrue($value === null || \is_scalar($value), $key);
        }

        self::assertSame('topic_created', $payload['event']);
        self::assertSame(self::TOPIC, $payload['topic_id']);
        self::assertSame('public', $payload['topic_visibility']);
        self::assertSame('Export failed', $payload['topic_title']);
        self::assertSame('Export does not work.', $payload['topic_content_text']);
        self::assertSame('export,csv', $payload['topic_tags']);
        self::assertSame('7,9', $payload['topic_tag_ids']);
        self::assertSame('2026-10-20T09:30:00+00:00', $payload['topic_created_at']);
        self::assertSame(self::AUTHOR, $payload['author_id']);
        self::assertSame('jane@example.com', $payload['author_email']);
    }

    public function testEveryFieldTheRegistryListsIsInThePayload(): void
    {
        Events::topicCreated($this->topic('publish'));

        $payload = $this->fired()[0]['args'][0];

        foreach (array_keys(EventRegistry::all()['topic_created']['fields']) as $field) {
            self::assertArrayHasKey($field, $payload);
        }
    }

    public function testASiteMayRemoveAField(): void
    {
        $GLOBALS['__wp_filters']['bit_connect_event_payload'] = static function (array $payload): array {
            unset($payload['author_email']);

            return $payload;
        };

        Events::topicCreated($this->topic('publish'));

        self::assertArrayNotHasKey('author_email', $this->fired()[0]['args'][0]);
    }

    public function testTheEnvelopeSurvivesThePayloadFilter(): void
    {
        $GLOBALS['__wp_filters']['bit_connect_event_payload'] = ['event' => 'forged', 'nested' => ['x']];

        Events::topicCreated($this->topic('publish'));

        $payload = $this->fired()[0]['args'][0];

        self::assertSame('topic_created', $payload['event']);
        self::assertArrayNotHasKey('nested', $payload);
    }

    public function testAnUnregisteredEventIsNotAnnounced(): void
    {
        Events::announce('nothing_registered', ['a' => 1]);

        self::assertSame([], $this->fired());
    }

    public function testACommentCarriesItsTopicAndItsStatus(): void
    {
        $comment = new WP_Comment();
        $comment->comment_ID = 128;
        $comment->comment_post_ID = self::TOPIC;
        $comment->comment_parent = 0;
        $comment->user_id = self::ACTOR;
        $comment->comment_content = '<p>Try again.</p>';
        $comment->comment_approved = '0';
        $comment->comment_date_gmt = '2026-10-20 10:05:00';

        Events::commentCreated($comment, $this->topic('publish'));

        $payload = $this->fired()[0]['args'][0];

        self::assertSame('bit_connect_comment_created', $this->fired()[0]['tag']);
        self::assertSame(128, $payload['comment_id']);
        self::assertSame('pending', $payload['comment_status']);
        self::assertSame(self::TOPIC, $payload['topic_id']);
        self::assertSame(self::ACTOR, $payload['author_id']);
    }

    public function testAStatusChangeSaysWhatItWasAndWhoChangedIt(): void
    {
        Events::topicStatusChanged($this->topic('publish'), 'Open', 'New', ['statuses']);

        $payload = $this->fired()[0]['args'][0];

        self::assertSame('Open', $payload['from_status']);
        self::assertSame('statuses', $payload['changed']);
        self::assertSame(self::ACTOR, $payload['actor_id']);
        self::assertSame(self::AUTHOR, $payload['author_id']);
    }

    public function testASystemActionHasNoActor(): void
    {
        Events::moderationAction(0, ActivityActions::HIDE, 'post', self::TOPIC, self::AUTHOR, null, ['post_title' => 'Export failed']);

        $payload = $this->fired()[0]['args'][0];

        self::assertSame('bit_connect_moderation_action', $this->fired()[0]['tag']);
        self::assertTrue($payload['actor_system']);
        self::assertSame(0, $payload['actor_id']);
        self::assertSame('hide', $payload['action']);
        self::assertSame('Hidden after a report', $payload['action_label']);
        self::assertSame('Export failed', $payload['target_title']);
        self::assertSame(self::AUTHOR, $payload['target_author_id']);
    }

    public function testACreatedTopicIsAnnouncedOnce(): void
    {
        $post = $this->topic('publish');

        TopicPublication::markCreated($post);
        TopicPublication::markCreated($post);
        TopicPublication::onTransition('publish', 'draft', $post);

        self::assertCount(1, array_filter($this->fired(), static fn (array $a): bool => $a['tag'] === 'bit_connect_topic_created'));
    }

    public function testATopicCreatedHiddenIsNotAnnounced(): void
    {
        TopicPublication::markCreated($this->topic('bit_connect_hidden'));

        self::assertSame([], $this->fired());
    }

    public function testTheInsertTransitionIsLeftToMarkCreated(): void
    {
        TopicPublication::creating(true);
        TopicPublication::onTransition('publish', 'new', $this->topic('publish'));
        TopicPublication::creating(false);

        self::assertSame([], $this->fired());
    }

    public function testADraftPublishedLaterIsAnnounced(): void
    {
        TopicPublication::onTransition('publish', 'draft', $this->topic('publish'));

        self::assertSame('bit_connect_topic_created', $this->fired()[0]['tag'] ?? null);
    }

    public function testATopicRestoredAfterAReportIsNotNew(): void
    {
        TopicPublication::onTransition('publish', 'bit_connect_hidden', $this->topic('publish'));

        self::assertSame([], $this->fired());
    }

    /**
     * @return list<array{tag: string, args: array}>
     */
    private function fired(): array
    {
        return array_values(
            array_filter(
                $GLOBALS['__wp_actions_fired'],
                static fn (array $a): bool => str_starts_with($a['tag'], 'bit_connect_')
            )
        );
    }

    private function topic(string $status): WP_Post
    {
        $post = new WP_Post();
        $post->ID = self::TOPIC;
        $post->post_author = self::AUTHOR;
        $post->post_title = 'Export failed';
        $post->post_content = '<p>Export does not work.</p>';
        $post->post_status = $status;
        $post->post_type = 'bit-connect';
        $post->post_date_gmt = '2026-10-20 09:30:00';

        return $post;
    }

    private function user(int $id, string $login, string $name): WP_User
    {
        $user = new WP_User();
        $user->ID = $id;
        $user->user_login = $login;
        $user->display_name = $name;
        $user->user_email = $login . '@example.com';
        $user->roles = ['subscriber'];

        return $user;
    }

    private function term(int $id, string $name): WP_Term
    {
        $term = new WP_Term();
        $term->term_id = $id;
        $term->name = $name;
        $term->taxonomy = Taxonomies::TAGS->value;

        return $term;
    }
}
