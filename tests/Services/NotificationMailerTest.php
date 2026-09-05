<?php

namespace BitApps\BitConnect\Tests\Services;

use BitApps\BitConnect\Enum\NotificationTypes;
use BitApps\BitConnect\Services\NotificationMailer;
use PHPUnit\Framework\TestCase;
use WP_User;

/**
 * How a notification reads once it is in somebody's inbox.
 *
 * The wording is the whole product here — an email nobody can parse at a glance
 * is an email that trains people to filter the forum out. Two properties matter
 * more than the phrasing itself, and both are pinned below: a line has to make
 * sense after its subject has been deleted, and a collapsed row has to say how
 * many rather than naming one person and quietly dropping the rest.
 *
 * @internal
 *
 * @coversNothing
 */
class NotificationMailerTest extends TestCase
{
    private const ACTOR = 12;

    protected function setUp(): void
    {
        $actor = new WP_User();
        $actor->ID = self::ACTOR;
        $actor->display_name = 'Aiden Carter';

        $GLOBALS['__wp_users'] = [self::ACTOR => $actor];
        $GLOBALS['__wp_options'] = [];
    }

    public function testAReplyNamesThePersonAndTheTopic(): void
    {
        $line = NotificationMailer::line(
            self::row(NotificationTypes::TOPIC_REPLY, ['topic_title' => 'hello world', 'url' => 'https://f.test/t/1'])
        );

        $this->assertStringContainsString('Aiden Carter', $line);
        $this->assertStringContainsString('"hello world"', $line);
        $this->assertStringContainsString('https://f.test/t/1', $line);
    }

    /**
     * The reason `context` stores a title and excerpt instead of looking them
     * up. A digest goes out after the fact, and the notification that matters
     * most — your content was removed — is exactly the one whose target is gone
     * by the time anyone reads about it.
     */
    public function testALineStillReadsWhenItsTargetIsGone(): void
    {
        $line = NotificationMailer::line(self::row(NotificationTypes::CONTENT_ACTIONED, []));

        $this->assertStringContainsString('removed', $line);
        $this->assertNotSame('', trim(str_replace('*', '', $line)));
    }

    public function testAMissingTitleDoesNotLeaveAnEmptyQuote(): void
    {
        $line = NotificationMailer::line(self::row(NotificationTypes::TOPIC_REPLY, []));

        $this->assertStringNotContainsString('""', $line, 'an empty pair of quotes reads as a bug');
        $this->assertStringContainsString('a topic', $line);
    }

    /**
     * Votes are the one collapsible type, so this line speaks for several
     * people. Naming the last voter would credit one person with everyone
     * else's votes.
     */
    public function testACollapsedVoteSaysHowManyRatherThanWho(): void
    {
        $line = NotificationMailer::line(
            self::row(NotificationTypes::VOTE_RECEIVED, ['topic_title' => 'hello world'], 7)
        );

        $this->assertStringContainsString('7', $line);
        $this->assertStringNotContainsString('Aiden Carter', $line);
    }

    public function testASingleVoteNamesTheVoter(): void
    {
        $line = NotificationMailer::line(
            self::row(NotificationTypes::VOTE_RECEIVED, ['topic_title' => 'hello world'])
        );

        $this->assertStringContainsString('Aiden Carter', $line);
    }

    /**
     * An auto-hide has no actor — the rule acted, not a moderator. Naming
     * "(deleted account)" or anyone else would invent a person.
     */
    public function testAnEventWithNoActorDoesNotInventOne(): void
    {
        $row = self::row(NotificationTypes::TOPIC_REPLY, ['topic_title' => 'hello world']);
        $row->actor_id = 0;

        $line = NotificationMailer::line($row);

        $this->assertStringContainsString('Someone', $line);
        $this->assertStringNotContainsString('Aiden Carter', $line);
    }

    public function testALineWithNoUrlDoesNotTrailAnEmptySecondLine(): void
    {
        $line = NotificationMailer::line(self::row(NotificationTypes::BADGE_AWARDED, ['badge_label' => 'Developer']));

        $this->assertStringContainsString('Developer', $line);
        $this->assertStringNotContainsString("\n", $line);
    }

    /**
     * @param array<string, mixed> $context
     */
    private static function row(NotificationTypes $type, array $context, int $count = 1): object
    {
        return (object) [
            'id'          => 1,
            'type'        => $type->value,
            'actor_id'    => self::ACTOR,
            'target_type' => 'comment',
            'target_id'   => 99,
            'topic_id'    => 5,
            'context'     => $context === [] ? null : json_encode($context),
            'event_count' => $count,
            'read_at'     => null,
            'created_at'  => '2026-08-06 10:00:00',
        ];
    }
}
