<?php

namespace BitApps\BitConnect\Tests\Services;

use BitApps\BitConnect\Config;
use BitApps\BitConnect\Enum\NotificationTypes;
use BitApps\BitConnect\Model\Follow;
use BitApps\BitConnect\Services\NotificationPreferences;
use BitApps\BitConnect\Services\NotificationRecipients;
use BitApps\BitConnect\Services\NotificationService;
use PHPUnit\Framework\TestCase;
use WP_Comment;
use WP_Post;

/**
 * Who a dispatched event actually reaches, and what is written for them.
 *
 * Every rule here is one that fails silently. Nobody reports the notification
 * they never got; one sent to the wrong person looks like a bug in somebody
 * else's feed; and a member notified about their own reply reads as the forum
 * being broken in a way nobody can reproduce on purpose.
 *
 * The actor exclusion is the one worth stating twice: it is applied last and
 * unconditionally, after the recipients filter, so a third-party listener that
 * adds people back cannot put the author of an action into their own bell.
 *
 * @internal
 *
 * @coversNothing
 */
final class NotificationDispatchTest extends TestCase
{
    private const AUTHOR = 7;

    private const FOLLOWER = 8;

    private const ACTOR = 3;

    private const TOPIC = 1491;

    private const COMMENT = 55;

    protected function setUp(): void
    {
        $GLOBALS['__bc_notifications'] = [];
        $GLOBALS['__bc_follows'] = [];
        $GLOBALS['__wp_actions_fired'] = [];
        $GLOBALS['__wp_options'] = [];
        $GLOBALS['__wp_user_meta'] = [];
        $GLOBALS['__wp_transients'] = [];
        $GLOBALS['__wp_filters'] = [];
        $GLOBALS['__wp_current_user_id'] = self::ACTOR;
        $GLOBALS['__wp_posts'] = [self::TOPIC => $this->topic(self::AUTHOR)];
        $GLOBALS['__wp_comments'] = [self::COMMENT => $this->comment(self::AUTHOR)];
        $GLOBALS['wpdb']->failWrites = false;

        unset($GLOBALS['__bc_notification_insert_fails']);

        NotificationPreferences::flushSettings();
        NotificationRecipients::flushModerators();
    }

    protected function tearDown(): void
    {
        $GLOBALS['__bc_notifications'] = [];
        $GLOBALS['__bc_follows'] = [];
        $GLOBALS['__wp_posts'] = [];
        $GLOBALS['__wp_comments'] = [];
        $GLOBALS['__wp_current_user_id'] = 0;
        $GLOBALS['__wp_filters'] = [];

        NotificationPreferences::flushSettings();
        NotificationRecipients::flushModerators();
    }

    // -----------------------------------------------------------------------
    // The master switch
    // -----------------------------------------------------------------------

    /**
     * A forum that upgrades into this feature should start notifying rather
     * than sit silent until someone finds the switch.
     */
    public function testAForumThatHasNeverSeenTheSettingStillNotifies(): void
    {
        $this->assertSame(1, $this->dispatchVoteOnTopic());
    }

    public function testTurningNotificationsOffWritesNothingAtAll(): void
    {
        $GLOBALS['__wp_options'][Config::withPrefix('notification_settings')] = ['enabled' => false];
        NotificationPreferences::flushSettings();

        $this->assertSame(0, $this->dispatchVoteOnTopic());
        $this->assertSame([], $GLOBALS['__bc_notifications']);
    }

    public function testAnEventPointingAtNothingIsNotSent(): void
    {
        $this->assertSame(
            0,
            NotificationService::dispatch(NotificationTypes::VOTE_RECEIVED, NotificationService::TARGET_TOPIC, 0)
        );
    }

    // -----------------------------------------------------------------------
    // Who hears about it
    // -----------------------------------------------------------------------

    public function testAVoteOnATopicReachesItsAuthor(): void
    {
        $this->dispatchVoteOnTopic();

        $this->assertSame([self::AUTHOR], $this->recipients());
    }

    public function testAVoteOnACommentReachesItsAuthor(): void
    {
        NotificationService::dispatch(
            NotificationTypes::VOTE_RECEIVED,
            NotificationService::TARGET_COMMENT,
            self::COMMENT,
            [],
            self::TOPIC
        );

        $this->assertSame([self::AUTHOR], $this->recipients());
    }

    public function testAReplyReachesEveryoneFollowingTheTopic(): void
    {
        $GLOBALS['__bc_follows'] = [
            ['user_id' => self::FOLLOWER, 'target_type' => Follow::TARGET_TOPIC, 'target_id' => self::TOPIC, 'muted' => 0],
        ];

        NotificationService::dispatch(
            NotificationTypes::TOPIC_REPLY,
            NotificationService::TARGET_COMMENT,
            self::COMMENT,
            [],
            self::TOPIC
        );

        $this->assertContains(self::FOLLOWER, $this->recipients());
    }

    /**
     * Nobody is notified about what they did themselves.
     */
    public function testTheActorIsNeverToldAboutTheirOwnAction(): void
    {
        $GLOBALS['__wp_posts'][self::TOPIC] = $this->topic(self::ACTOR);

        $this->assertSame(0, $this->dispatchVoteOnTopic());
    }

    /**
     * Applied after the recipients filter and unconditionally, so a listener
     * that adds people back cannot reintroduce them.
     */
    public function testAFilterCannotPutTheActorBackIn(): void
    {
        $GLOBALS['__wp_filters']['bit_connect_notification_recipients'] = [self::ACTOR, self::FOLLOWER];

        $this->dispatchVoteOnTopic();

        $this->assertSame([self::FOLLOWER], $this->recipients());
    }

    public function testAFilterMayAddSomeoneWhoWouldNotOtherwiseHear(): void
    {
        $GLOBALS['__wp_filters']['bit_connect_notification_recipients'] = [self::FOLLOWER];

        $this->dispatchVoteOnTopic();

        $this->assertSame([self::FOLLOWER], $this->recipients());
    }

    public function testAFilterMayTakeEveryoneOut(): void
    {
        $GLOBALS['__wp_filters']['bit_connect_notification_recipients'] = [];

        $this->assertSame(0, $this->dispatchVoteOnTopic());
    }

    /**
     * The call site names people it has already told about the same event —
     * a mention inside a reply, most of all, where the mentioned member would
     * otherwise get both the mention and the reply.
     */
    public function testPeopleTheCallSiteHasAlreadyToldAreSkipped(): void
    {
        NotificationService::dispatch(
            NotificationTypes::VOTE_RECEIVED,
            NotificationService::TARGET_TOPIC,
            self::TOPIC,
            [],
            self::TOPIC,
            [self::AUTHOR, self::FOLLOWER],
            [self::AUTHOR]
        );

        $this->assertSame([self::FOLLOWER], $this->recipients());
    }

    public function testNobodyIsNotifiedTwiceForOneEvent(): void
    {
        NotificationService::dispatch(
            NotificationTypes::TOPIC_NEW,
            NotificationService::TARGET_TOPIC,
            self::TOPIC,
            [],
            self::TOPIC,
            [self::FOLLOWER, self::FOLLOWER, self::FOLLOWER]
        );

        $this->assertSame([self::FOLLOWER], $this->recipients());
    }

    public function testIdsThatAreNotPeopleAreDropped(): void
    {
        NotificationService::dispatch(
            NotificationTypes::TOPIC_NEW,
            NotificationService::TARGET_TOPIC,
            self::TOPIC,
            [],
            self::TOPIC,
            [0, -1, self::FOLLOWER]
        );

        $this->assertSame([self::FOLLOWER], $this->recipients());
    }

    /**
     * Dispatching one of these without recipients means the call site forgot,
     * and sending it to a guessed audience would be worse than sending it to
     * nobody.
     */
    public function testATypeWithNoDerivableAudienceReachesNobodyByItself(): void
    {
        $this->assertSame(
            0,
            NotificationService::dispatch(
                NotificationTypes::MENTION,
                NotificationService::TARGET_COMMENT,
                self::COMMENT,
                [],
                self::TOPIC
            )
        );
    }

    // -----------------------------------------------------------------------
    // Events nobody chose
    // -----------------------------------------------------------------------

    /**
     * An auto-hide fires on the request of whoever tripped the threshold — the
     * reporter, who decided nothing. Attributing it to them would credit them
     * with a moderator's decision.
     */
    public function testASystemEventIsAttributedToNobody(): void
    {
        NotificationService::dispatchAsSystem(
            NotificationTypes::CONTENT_ACTIONED,
            NotificationService::TARGET_TOPIC,
            self::TOPIC,
            [],
            self::TOPIC
        );

        $this->assertNull($this->onlyRow()['actor_id']);
    }

    /**
     * With no actor there is nobody to exclude, so an event about the current
     * user's own content still reaches them.
     */
    public function testASystemEventStillReachesSomeoneWhoTrippedItThemselves(): void
    {
        $GLOBALS['__wp_posts'][self::TOPIC] = $this->topic(self::ACTOR);

        $sent = NotificationService::dispatchAsSystem(
            NotificationTypes::CONTENT_ACTIONED,
            NotificationService::TARGET_TOPIC,
            self::TOPIC,
            [],
            self::TOPIC
        );

        $this->assertSame(1, $sent);
    }

    // -----------------------------------------------------------------------
    // What is written
    // -----------------------------------------------------------------------

    public function testTheRowCarriesEnoughToRenderItAfterItsTargetIsGone(): void
    {
        NotificationService::dispatch(
            NotificationTypes::VOTE_RECEIVED,
            NotificationService::TARGET_TOPIC,
            self::TOPIC,
            ['topic_title' => 'Cannot log in', 'url' => 'https://example.com/t/1'],
            self::TOPIC
        );

        $row = $this->onlyRow();

        $this->assertSame(self::AUTHOR, $row['user_id']);
        $this->assertSame(self::ACTOR, $row['actor_id']);
        $this->assertSame('vote_received', $row['type']);
        $this->assertSame(self::TOPIC, $row['target_id']);
        $this->assertSame(
            ['topic_title' => 'Cannot log in', 'url' => 'https://example.com/t/1'],
            json_decode($row['context'], true)
        );
    }

    public function testAnEmptyContextIsStoredAsNothing(): void
    {
        $this->dispatchVoteOnTopic();

        $this->assertNull($this->onlyRow()['context']);
    }

    /**
     * Stamping the rows nobody wants mailed keeps the digest's index scan to
     * exactly the rows it has work for.
     */
    public function testARowNobodyWantsMailedIsStampedAsAlreadyHandled(): void
    {
        $this->dispatchVoteOnTopic();

        // Email defaults to off for votes — nobody wants mail every time a
        // stranger upvotes them.
        $this->assertNotNull($this->onlyRow()['emailed_at']);
    }

    public function testARowThatOwesAnEmailIsLeftUnstamped(): void
    {
        NotificationService::dispatch(
            NotificationTypes::COMMENT_REPLY,
            NotificationService::TARGET_COMMENT,
            self::COMMENT,
            [],
            self::TOPIC
        );

        $this->assertNull($this->onlyRow()['emailed_at']);
    }

    /**
     * The seam instant email hangs off, and where a push or chat channel would
     * attach.
     */
    public function testEachDeliveryAnnouncesItself(): void
    {
        $this->dispatchVoteOnTopic();

        $fired = array_values(
            array_filter(
                $GLOBALS['__wp_actions_fired'],
                static fn ($action) => $action['tag'] === 'bit_connect_notification_dispatched'
            )
        );

        $this->assertCount(1, $fired);
        $this->assertSame(self::AUTHOR, $fired[0]['args'][0]);
        $this->assertSame('vote_received', $fired[0]['args'][1]);
        $this->assertSame(1, $fired[0]['args'][3]);
    }

    /**
     * Reporting a write that never happened is how a duplicate-column bug in
     * the reports table survived a green test run.
     */
    public function testAWriteThatFailedIsNotCountedAsDelivered(): void
    {
        $GLOBALS['__bc_notification_insert_fails'] = true;

        $this->assertSame(0, $this->dispatchVoteOnTopic());
    }

    // -----------------------------------------------------------------------
    // Collapsing
    // -----------------------------------------------------------------------

    /**
     * A vote carries nothing of its own to read, so fifty of them are one fact.
     * Fifty rows would bury every other notification the member has.
     */
    public function testRepeatedVotesFoldIntoOneRow(): void
    {
        $this->dispatchVoteOnTopic();
        $this->dispatchVoteOnTopic(actorId: 4);
        $this->dispatchVoteOnTopic(actorId: 5);

        $this->assertCount(1, $GLOBALS['__bc_notifications']);
        $this->assertSame(3, $this->onlyRow()['event_count']);
    }

    public function testACollapsedEventIsStillReportedAsDelivered(): void
    {
        $this->dispatchVoteOnTopic();

        $this->assertSame(1, $this->dispatchVoteOnTopic(actorId: 4));
    }

    /**
     * Each reply is a distinct thing somebody wrote and needs its own link.
     */
    public function testRepliesNeverFoldIntoEachOther(): void
    {
        NotificationService::dispatch(NotificationTypes::COMMENT_REPLY, NotificationService::TARGET_COMMENT, self::COMMENT, [], self::TOPIC);
        NotificationService::dispatch(NotificationTypes::COMMENT_REPLY, NotificationService::TARGET_COMMENT, self::COMMENT, [], self::TOPIC);

        $this->assertCount(2, $GLOBALS['__bc_notifications']);
    }

    public function testVotesOnDifferentThingsGetRowsOfTheirOwn(): void
    {
        $this->dispatchVoteOnTopic();

        NotificationService::dispatch(
            NotificationTypes::VOTE_RECEIVED,
            NotificationService::TARGET_COMMENT,
            self::COMMENT,
            [],
            self::TOPIC
        );

        $this->assertCount(2, $GLOBALS['__bc_notifications']);
    }

    /**
     * Someone read it between the select and the update, so this event deserves
     * a row of its own after all.
     */
    public function testAVoteArrivingAfterTheRowWasReadGetsItsOwnRow(): void
    {
        $this->dispatchVoteOnTopic();
        $GLOBALS['__bc_notifications'][0]['read_at'] = '2026-08-27 09:00:00';

        $this->dispatchVoteOnTopic(actorId: 4);

        $this->assertCount(2, $GLOBALS['__bc_notifications']);
    }

    // -----------------------------------------------------------------------
    // Member preferences
    // -----------------------------------------------------------------------

    public function testAMemberWhoTurnedATypeOffIsNotSentIt(): void
    {
        $GLOBALS['__wp_user_meta'][self::AUTHOR]['bit_connect_notification_prefs'] = [
            'types' => ['vote_received' => ['inapp' => false]],
        ];

        $this->assertSame(0, $this->dispatchVoteOnTopic());
    }

    /**
     * Not negotiable, and checked before anything else, so neither an admin nor
     * the member can end up with a removal nobody was told about.
     */
    public function testAMemberCannotTurnOffBeingToldTheirContentWasActedOn(): void
    {
        $GLOBALS['__wp_user_meta'][self::AUTHOR]['bit_connect_notification_prefs'] = [
            'types' => ['content_actioned' => ['inapp' => false]],
        ];

        $sent = NotificationService::dispatchAsSystem(
            NotificationTypes::CONTENT_ACTIONED,
            NotificationService::TARGET_TOPIC,
            self::TOPIC,
            [],
            self::TOPIC
        );

        $this->assertSame(1, $sent);
    }

    // -----------------------------------------------------------------------
    // Helpers
    // -----------------------------------------------------------------------

    private function dispatchVoteOnTopic(int $actorId = self::ACTOR): int
    {
        $GLOBALS['__wp_current_user_id'] = $actorId;

        return NotificationService::dispatch(
            NotificationTypes::VOTE_RECEIVED,
            NotificationService::TARGET_TOPIC,
            self::TOPIC,
            [],
            self::TOPIC
        );
    }

    /**
     * @return array<int, int>
     */
    private function recipients(): array
    {
        return array_values(
            array_unique(
                array_map(
                    static fn ($row) => (int) $row['user_id'],
                    $GLOBALS['__bc_notifications']
                )
            )
        );
    }

    /**
     * @return array<string, mixed>
     */
    private function onlyRow(): array
    {
        $this->assertCount(1, $GLOBALS['__bc_notifications']);

        return $GLOBALS['__bc_notifications'][0];
    }

    private function topic(int $authorId): WP_Post
    {
        $post = new WP_Post();
        $post->ID = self::TOPIC;
        $post->post_author = $authorId;
        $post->post_title = 'Cannot log in';
        $post->post_status = 'publish';
        $post->post_type = 'bit-connect';

        return $post;
    }

    private function comment(int $authorId): WP_Comment
    {
        $comment = new WP_Comment();
        $comment->comment_ID = self::COMMENT;
        $comment->user_id = $authorId;
        $comment->comment_post_ID = self::TOPIC;
        $comment->comment_content = 'Same here.';
        $comment->comment_approved = '1';

        return $comment;
    }
}
