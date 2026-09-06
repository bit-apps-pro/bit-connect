<?php

namespace BitApps\BitConnect\Tests\Services;

use BitApps\BitConnect\Model\Follow;
use BitApps\BitConnect\Services\NotificationRecipients;
use PHPUnit\Framework\TestCase;
use WP_Post;

/**
 * Who a notification reaches.
 *
 * The part of the system where a mistake is easiest to make and hardest to see:
 * nobody reports the notification they never got, and a mute that quietly
 * stopped working looks exactly like a quiet week. So the rules are pinned here
 * rather than left to be noticed in production.
 *
 * @internal
 *
 * @coversNothing
 */
class NotificationRecipientsTest extends TestCase
{
    private const AUTHOR = 7;

    private const FOLLOWER = 8;

    private const MUTED_FOLLOWER = 9;

    private const TOPIC = 1491;

    protected function setUp(): void
    {
        $GLOBALS['__bc_follows'] = [];
        $GLOBALS['__wp_posts'] = [
            self::TOPIC => self::topic(self::AUTHOR),
        ];

        NotificationRecipients::flushModerators();
    }

    public function testTheAuthorHearsAboutTheirOwnTopicWithoutAFollowRow(): void
    {
        // A topic written before following existed has no row, and its author is
        // exactly the person who should hear that somebody finally replied.
        $this->assertSame([self::AUTHOR], NotificationRecipients::topicAudience(self::TOPIC));
    }

    public function testFollowersAndTheAuthorAreAllToldOnce(): void
    {
        $GLOBALS['__bc_follows'] = [
            self::follow(self::FOLLOWER),
            // The author's own auto-follow row. Must not produce a second copy.
            self::follow(self::AUTHOR),
        ];

        $audience = NotificationRecipients::topicAudience(self::TOPIC);
        sort($audience);

        $this->assertSame([self::AUTHOR, self::FOLLOWER], $audience);
    }

    public function testAMutedFollowerIsNotInTheAudience(): void
    {
        $GLOBALS['__bc_follows'] = [
            self::follow(self::FOLLOWER),
            self::follow(self::MUTED_FOLLOWER, true),
        ];

        $audience = NotificationRecipients::topicAudience(self::TOPIC);

        $this->assertNotContains(self::MUTED_FOLLOWER, $audience);
        $this->assertContains(self::FOLLOWER, $audience);
    }

    /**
     * The regression this test exists for.
     *
     * The author used to be added to the audience unconditionally, on the
     * reasoning that a topic with no follow row still has someone who should
     * hear about it. True — but "no row" and "muted" are not the same state:
     * the first is silence, the second is a decision. Treating them alike meant
     * Mute did nothing at all on the threads people most want to mute, the busy
     * ones they started themselves, and the mute was honoured for every
     * follower except the one person who could not escape it.
     */
    public function testAnAuthorWhoMutedTheirOwnTopicIsNotToldAboutIt(): void
    {
        $GLOBALS['__bc_follows'] = [
            self::follow(self::AUTHOR, true),
            self::follow(self::FOLLOWER),
        ];

        $audience = NotificationRecipients::topicAudience(self::TOPIC);

        $this->assertNotContains(
            self::AUTHOR,
            $audience,
            'muting your own topic has to silence it, or the button is a lie'
        );
        $this->assertSame([self::FOLLOWER], $audience);
    }

    public function testATopicThatNoLongerExistsHasNoAudience(): void
    {
        $this->assertSame([], NotificationRecipients::topicAudience(999999));
    }

    public function testAGuestAuthoredTopicYieldsNobody(): void
    {
        $GLOBALS['__wp_posts'][self::TOPIC] = self::topic(0);

        $this->assertSame([], NotificationRecipients::topicAudience(self::TOPIC));
    }

    public function testTheCommentAuthorIsNullForAGuestOrAMissingComment(): void
    {
        $GLOBALS['__wp_comments'] = [
            5 => (object) ['user_id' => 0],
            6 => (object) ['user_id' => self::FOLLOWER],
        ];

        $this->assertNull(NotificationRecipients::commentAuthor(5), 'a guest comment has no member to notify');
        $this->assertNull(NotificationRecipients::commentAuthor(404));
        $this->assertSame(self::FOLLOWER, NotificationRecipients::commentAuthor(6));
    }

    /**
     * @return array<string, mixed>
     */
    private static function follow(int $userId, bool $muted = false): array
    {
        return [
            'user_id'     => $userId,
            'target_type' => Follow::TARGET_TOPIC,
            'target_id'   => self::TOPIC,
            'muted'       => $muted ? 1 : 0,
        ];
    }

    private static function topic(int $author): WP_Post
    {
        $post = new WP_Post();
        $post->ID = self::TOPIC;
        $post->post_author = $author;
        $post->post_title = 'hello world';

        return $post;
    }
}
