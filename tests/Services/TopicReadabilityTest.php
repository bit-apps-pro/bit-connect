<?php

namespace BitApps\BitConnect\Tests\Services;

use BitApps\BitConnect\Enum\Capabilities;
use BitApps\BitConnect\Services\ContentVisibilityService;
use BitApps\BitConnect\Services\TopicService;
use PHPUnit\Framework\TestCase;
use WP_Post;

/**
 * Who may read a single topic looked up by ID or slug.
 *
 * Those lookups bypass the listing query's status list and `perm => readable`,
 * and before TopicService::isReadable() they checked only the hidden status: a
 * private topic's title and body were served to a logged-out visitor through
 * the topic page's hydration state, `topics?name=` and `posts/{id}`.
 *
 * @internal
 *
 * @coversNothing
 */
final class TopicReadabilityTest extends TestCase
{
    private const AUTHOR = 7;

    private const OTHER = 8;

    protected function tearDown(): void
    {
        $GLOBALS['__wp_caps'] = [];
        $GLOBALS['__wp_current_user_id'] = 0;
    }

    public function testAPublishedTopicIsReadableByAGuest(): void
    {
        $this->assertTrue(TopicService::isReadable($this->topic('publish')));
    }

    public function testAPrivateTopicIsNotReadableByAGuest(): void
    {
        $this->assertFalse(TopicService::isReadable($this->topic('private')));
    }

    public function testAPrivateTopicIsNotReadableByAnotherMember(): void
    {
        $this->actAs(self::OTHER);

        $this->assertFalse(TopicService::isReadable($this->topic('private')));
    }

    public function testAPrivateTopicIsReadableByItsAuthor(): void
    {
        $this->actAs(self::AUTHOR);

        $this->assertTrue(TopicService::isReadable($this->topic('private')));
    }

    public function testAPrivateTopicIsReadableByWhoeverMayReadPrivatePosts(): void
    {
        $this->actAs(self::OTHER, ['read_private_posts' => true]);

        $this->assertTrue(TopicService::isReadable($this->topic('private')));
    }

    public function testAHiddenTopicIsReadableByAModeratorAndItsAuthorOnly(): void
    {
        $hidden = $this->topic(ContentVisibilityService::HIDDEN_STATUS);

        $this->assertFalse(TopicService::isReadable($hidden));

        $this->actAs(self::OTHER);
        $this->assertFalse(TopicService::isReadable($hidden));

        $this->actAs(self::AUTHOR);
        $this->assertTrue(TopicService::isReadable($hidden));

        $this->actAs(self::OTHER, [Capabilities::MODERATE->value => true]);
        $this->assertTrue(TopicService::isReadable($hidden));
    }

    /**
     * A status the portal never writes is readable by nobody, author included.
     */
    public function testAnyOtherStatusIsNotReadable(): void
    {
        $this->actAs(self::AUTHOR, ['read_private_posts' => true]);

        foreach (['draft', 'pending', 'future', 'trash', 'auto-draft'] as $status) {
            $this->assertFalse(TopicService::isReadable($this->topic($status)), $status);
        }
    }

    private function topic(string $status): WP_Post
    {
        $post = new WP_Post();
        $post->ID = 101;
        $post->post_type = 'bit-connect';
        $post->post_status = $status;
        $post->post_author = self::AUTHOR;

        return $post;
    }

    /**
     * @param array<string, bool> $caps
     */
    private function actAs(int $userId, array $caps = []): void
    {
        $GLOBALS['__wp_current_user_id'] = $userId;
        $GLOBALS['__wp_caps'] = $caps;
    }
}
