<?php

namespace BitApps\BitConnect\Tests\Services;

use BitApps\BitConnect\Services\UserStatsService;
use PHPUnit\Framework\TestCase;
use WP_Comment;
use WP_Post;

/**
 * The cached totals are only as good as what drops them.
 *
 * Each case seeds a cached copy for user 7, fires the event, and checks whether
 * the copy survived — surviving means their profile would keep showing the old
 * number until the TTL backstop expired.
 */
class UserStatsInvalidationTest extends TestCase
{
    private const CACHE_KEY = 'bit_connect_user_stats_7';

    protected function setUp(): void
    {
        $GLOBALS['__wp_transients'] = [self::CACHE_KEY => ['topics' => 1]];
        $GLOBALS['__wp_posts']      = [];
        $GLOBALS['__wp_comments']   = [];
        $GLOBALS['__wp_actions']    = [];
    }

    public function testForgetDropsTheCachedTotals(): void
    {
        UserStatsService::forget(7);

        $this->assertArrayNotHasKey(self::CACHE_KEY, $GLOBALS['__wp_transients']);
    }

    public function testForgetAcceptsTheNumericStringWordPressHandsOut(): void
    {
        UserStatsService::forget('7');

        $this->assertArrayNotHasKey(self::CACHE_KEY, $GLOBALS['__wp_transients']);
    }

    public function testPublishingATopicDropsTheAuthorsTotals(): void
    {
        UserStatsService::handlePostStatusChanged('publish', 'draft', $this->topic());

        $this->assertCacheDropped();
    }

    public function testTrashingATopicDropsTheAuthorsTotals(): void
    {
        UserStatsService::handlePostStatusChanged('trash', 'publish', $this->topic());

        $this->assertCacheDropped();
    }

    public function testEditingAPublishedTopicLeavesTheCacheAlone(): void
    {
        // Every save transitions, most of them to the status already held.
        UserStatsService::handlePostStatusChanged('publish', 'publish', $this->topic());

        $this->assertCacheKept();
    }

    public function testAPostOutsideThePortalIsIgnored(): void
    {
        UserStatsService::handlePostStatusChanged('publish', 'draft', $this->topic('post'));

        $this->assertCacheKept();
    }

    public function testDeletingATopicDropsTheAuthorsTotals(): void
    {
        UserStatsService::handlePostDeleted(31, $this->topic());

        $this->assertCacheDropped();
    }

    public function testDeletingATopicIsIgnoredWhenNothingIdentifiesIt(): void
    {
        // WP < 5.5 passes the id alone, and the row it named is already gone.
        UserStatsService::handlePostDeleted(31);

        $this->assertCacheKept();
    }

    public function testAddingACommentDropsTheAuthorsTotals(): void
    {
        UserStatsService::handleCommentChanged(88, $this->comment());

        $this->assertCacheDropped();
    }

    public function testDeletingACommentLooksTheCommentUpWhenNotHandedOne(): void
    {
        $GLOBALS['__wp_comments'][88] = $this->comment();

        UserStatsService::handleCommentChanged(88);

        $this->assertCacheDropped();
    }

    public function testApprovingACommentDropsTheAuthorsTotals(): void
    {
        UserStatsService::handleCommentStatusChanged('approved', 'unapproved', $this->comment());

        $this->assertCacheDropped();
    }

    public function testAnUnchangedCommentStatusLeavesTheCacheAlone(): void
    {
        UserStatsService::handleCommentStatusChanged('approved', 'approved', $this->comment());

        $this->assertCacheKept();
    }

    public function testAGuestCommentMovesNobodysTotals(): void
    {
        UserStatsService::handleCommentChanged(88, $this->comment(0));

        $this->assertCacheKept();
    }

    public function testACommentOutsideThePortalIsIgnored(): void
    {
        $GLOBALS['__wp_posts'][12] = $this->topic('post');

        UserStatsService::handleCommentChanged(88, $this->comment());

        $this->assertCacheKept();
    }

    public function testRegisterHooksCoversEveryEventThatMovesACount(): void
    {
        UserStatsService::registerHooks();

        foreach (
            [
                'transition_post_status',
                'deleted_post',
                'wp_insert_comment',
                'transition_comment_status',
                'deleted_comment',
            ] as $tag
        ) {
            $this->assertArrayHasKey($tag, $GLOBALS['__wp_actions'], "{$tag} is not hooked");
        }
    }

    /**
     * A portal topic written by user 7, unless given another post type.
     */
    private function topic(string $postType = 'bit-connect'): WP_Post
    {
        $post              = new WP_Post();
        $post->ID          = 12;
        $post->post_author = '7';
        $post->post_type   = $postType;

        return $post;
    }

    /**
     * A comment on that topic, written by user 7 unless given another author.
     */
    private function comment(int $userId = 7): WP_Comment
    {
        $GLOBALS['__wp_posts'][12] ??= $this->topic();

        $comment                  = new WP_Comment();
        $comment->comment_ID      = '88';
        $comment->comment_post_ID = '12';
        $comment->user_id         = (string) $userId;

        return $comment;
    }

    private function assertCacheDropped(): void
    {
        $this->assertArrayNotHasKey(
            self::CACHE_KEY,
            $GLOBALS['__wp_transients'],
            'the stale totals survived the event'
        );
    }

    private function assertCacheKept(): void
    {
        $this->assertArrayHasKey(
            self::CACHE_KEY,
            $GLOBALS['__wp_transients'],
            'the totals were dropped by an event that does not move them'
        );
    }
}
