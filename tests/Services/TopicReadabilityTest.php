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
        $GLOBALS['__wp_user_caps'] = [];
        unset($GLOBALS['__wp_filters']['bit_connect_topic_readable']);
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

    // -----------------------------------------------------------------------
    // A plugin holding topics back (bit_connect_topic_readable)
    // -----------------------------------------------------------------------

    public function testAPluginCanHoldBackATopicTheRulesAllow(): void
    {
        $GLOBALS['__wp_filters']['bit_connect_topic_readable'] = static fn (): bool => false;

        $this->assertFalse(TopicService::isReadable($this->topic('publish')));
    }

    public function testAPluginCannotOpenATopicTheRulesRefuse(): void
    {
        $GLOBALS['__wp_filters']['bit_connect_topic_readable'] = static fn (): bool => true;

        $this->assertFalse(TopicService::isReadable($this->topic('private')));
    }

    public function testAnAnswerThatIsNotTrueHoldsTheTopicBack(): void
    {
        $GLOBALS['__wp_filters']['bit_connect_topic_readable'] = static fn () => 1;

        $this->assertFalse(TopicService::isReadable($this->topic('publish')));
    }

    public function testThePluginIsToldWhoIsReading(): void
    {
        $asked = [];
        $GLOBALS['__wp_filters']['bit_connect_topic_readable'] = static function (bool $readable, WP_Post $post, int $userId) use (&$asked): bool {
            $asked[] = $userId;

            return $readable;
        };

        $this->actAs(self::OTHER);
        TopicService::isReadable($this->topic('publish'));
        TopicService::isReadableBy($this->topic('publish'), self::AUTHOR);

        $this->assertSame([self::OTHER, self::AUTHOR], $asked);
    }

    // -----------------------------------------------------------------------
    // Asked for someone other than the current user (isReadableBy)
    // -----------------------------------------------------------------------

    public function testAPrivateTopicIsReadableByItsAuthorWhoeverIsAsking(): void
    {
        $this->actAs(self::OTHER);

        $this->assertTrue(TopicService::isReadableBy($this->topic('private'), self::AUTHOR));
    }

    public function testAPrivateTopicIsNotReadableByAnotherMemberWhoeverIsAsking(): void
    {
        $this->actAs(self::AUTHOR);

        $this->assertFalse(TopicService::isReadableBy($this->topic('private'), self::OTHER));
    }

    public function testTheMembersOwnCapabilitiesDecideNotTheAskers(): void
    {
        // The current user may read private posts; the member asked about may not.
        $this->actAs(1, ['read_private_posts' => true]);

        $this->assertFalse(TopicService::isReadableBy($this->topic('private'), self::OTHER));

        $GLOBALS['__wp_user_caps'][self::OTHER] = ['read_private_posts' => true];

        $this->assertTrue(TopicService::isReadableBy($this->topic('private'), self::OTHER));
    }

    public function testAHiddenTopicIsReadableByAModeratorWhoeverIsAsking(): void
    {
        $GLOBALS['__wp_user_caps'][self::OTHER] = [Capabilities::MODERATE->value => true];

        $this->assertTrue(TopicService::isReadableBy($this->topic(ContentVisibilityService::HIDDEN_STATUS), self::OTHER));
        $this->assertFalse(TopicService::isReadableBy($this->topic(ContentVisibilityService::HIDDEN_STATUS), 0));
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
