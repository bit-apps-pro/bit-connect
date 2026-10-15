<?php

namespace BitApps\BitConnect\Tests\Services;

use BitApps\BitConnect\Enum\ActivityActions;
use BitApps\BitConnect\Enum\Capabilities;
use BitApps\BitConnect\Services\ContentVisibilityService;
use BitApps\BitConnect\Services\TopicModerationService;
use PHPUnit\Framework\TestCase;
use WP_Post;

/**
 * Pins down what one bulk action reports for one topic.
 *
 * The admin's Topics screen sums these into "3 updated, 1 already so", so the
 * difference between skipped and failed is what the moderator reads: asking
 * for a state a topic is already in did what was asked, and must not be
 * counted as an error, while a topic the moderator may not read must never be
 * touched at all.
 *
 * @internal
 *
 * @coversNothing
 */
final class TopicModerationServiceTest extends TestCase
{
    private const AUTHOR = 3;

    private const MODERATOR = 7;

    protected function setUp(): void
    {
        $GLOBALS['__wp_current_user_id'] = self::MODERATOR;
        $GLOBALS['__wp_caps'] = [Capabilities::MODERATE->value => true];
    }

    protected function tearDown(): void
    {
        $GLOBALS['__wp_posts'] = [];
        $GLOBALS['__wp_post_meta'] = [];
        $GLOBALS['__wp_caps'] = [];
        $GLOBALS['__wp_current_user_id'] = 0;
        $GLOBALS['__bc_activity_log'] = [];
        unset($GLOBALS['__wp_options']['sticky_posts']);
    }

    public function testHidingATopicHidesItAndLogsIt(): void
    {
        $this->seedTopic(10, 'publish');

        $this->assertSame(TopicModerationService::OUTCOME_DONE, (new TopicModerationService())->apply('hide', 10));

        $this->assertSame(ContentVisibilityService::HIDDEN_STATUS, $GLOBALS['__wp_posts'][10]->post_status);
        $this->assertSame(ActivityActions::HIDE_POST->value, end($GLOBALS['__bc_activity_log'])['action']);
    }

    public function testHidingAHiddenTopicIsSkippedNotFailed(): void
    {
        $this->seedTopic(10, ContentVisibilityService::HIDDEN_STATUS);

        $this->assertSame(TopicModerationService::OUTCOME_SKIPPED, (new TopicModerationService())->apply('hide', 10));
        $this->assertSame([], $GLOBALS['__bc_activity_log'] ?? []);
    }

    public function testRestoringPutsATopicBackAndLogsIt(): void
    {
        $this->seedTopic(10, 'publish');
        ContentVisibilityService::hidePost(10);

        $this->assertSame(TopicModerationService::OUTCOME_DONE, (new TopicModerationService())->apply('restore', 10));

        $this->assertSame('publish', $GLOBALS['__wp_posts'][10]->post_status);
        $this->assertSame(ActivityActions::RESTORE->value, end($GLOBALS['__bc_activity_log'])['action']);
    }

    public function testRestoringATopicThatIsNotHiddenIsSkipped(): void
    {
        $this->seedTopic(10, 'publish');

        $this->assertSame(TopicModerationService::OUTCOME_SKIPPED, (new TopicModerationService())->apply('restore', 10));
    }

    public function testPinningAPinnedTopicIsSkipped(): void
    {
        $this->seedTopic(10, 'publish');
        $GLOBALS['__wp_options']['sticky_posts'] = [10];

        $this->assertSame(TopicModerationService::OUTCOME_SKIPPED, (new TopicModerationService())->apply('pin', 10));
    }

    public function testLockingALockedTopicIsSkipped(): void
    {
        $this->seedTopic(10, 'publish', 'closed');

        $this->assertSame(TopicModerationService::OUTCOME_SKIPPED, (new TopicModerationService())->apply('lock', 10));
    }

    public function testATopicThatIsNotThereFails(): void
    {
        $this->assertSame(TopicModerationService::OUTCOME_FAILED, (new TopicModerationService())->apply('hide', 404));
    }

    public function testAPostThatIsNotATopicIsNeverTouched(): void
    {
        $this->seedTopic(10, 'publish')->post_type = 'post';

        $this->assertSame(TopicModerationService::OUTCOME_FAILED, (new TopicModerationService())->apply('hide', 10));
        $this->assertSame('publish', $GLOBALS['__wp_posts'][10]->post_status);
    }

    /**
     * The table lists only what its reader may open, so the bulk path must
     * refuse the same topics — an id typed into the request is not a way round
     * that.
     */
    public function testAnUnreadableTopicIsNeverTouched(): void
    {
        $this->seedTopic(10, 'draft');

        $this->assertSame(TopicModerationService::OUTCOME_FAILED, (new TopicModerationService())->apply('hide', 10));
        $this->assertSame('draft', $GLOBALS['__wp_posts'][10]->post_status);
    }

    public function testAnUnknownActionFails(): void
    {
        $this->seedTopic(10, 'publish');

        $this->assertSame(TopicModerationService::OUTCOME_FAILED, (new TopicModerationService())->apply('archive', 10));
    }

    private function seedTopic(int $postId, string $status, string $commentStatus = 'open'): WP_Post
    {
        $post = new WP_Post();
        $post->ID = $postId;
        $post->post_type = 'bit-connect';
        $post->post_status = $status;
        $post->post_author = self::AUTHOR;
        $post->post_title = 'Topic ' . $postId;
        $post->comment_status = $commentStatus;

        $GLOBALS['__wp_posts'][$postId] = $post;

        return $post;
    }
}
