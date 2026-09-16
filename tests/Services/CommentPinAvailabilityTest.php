<?php

namespace BitApps\BitConnect\Tests\Services;

use BitApps\BitConnect\Services\ProFeatures;
use PHPUnit\Framework\TestCase;

/**
 * What this plugin says about pinning when nothing implements it.
 *
 * The whole of the free half is two extension points that answer "no" and "0",
 * and everything downstream — the `pinned` flag on a comment, the lift to the
 * front of the thread — is a consequence of the second one. So these cases are
 * the ones that matter most: if `pinnedCommentId()` ever stops answering 0 by
 * itself, a plugin with no pin action starts claiming replies are pinned.
 *
 * The cases with the add-on installed use the same double every other pro
 * extension point is tested through, which stores the pin where the real
 * service stores it rather than answering a fixed id.
 *
 * @internal
 *
 * @coversNothing
 */
final class CommentPinAvailabilityTest extends TestCase
{
    private const TOPIC = 41;

    private const REPLY = 907;

    protected function setUp(): void
    {
        $GLOBALS['__wp_filters'] = [];
        $GLOBALS['__wp_post_meta'] = [];
    }

    protected function tearDown(): void
    {
        bc_test_uninstall_pro_addon();
        $GLOBALS['__wp_filters'] = [];
        $GLOBALS['__wp_post_meta'] = [];
    }

    public function testAForumWithoutTheAddOnHasNoPinning(): void
    {
        $this->assertFalse(ProFeatures::commentPinning());
    }

    public function testNothingIsPinnedWhenNothingCanPin(): void
    {
        $this->assertSame(0, ProFeatures::pinnedCommentId(self::TOPIC));
    }

    public function testTheAddOnMakesPinningAvailable(): void
    {
        bc_test_install_pro_addon(['comment_pinning']);

        $this->assertTrue(ProFeatures::commentPinning());
    }

    public function testAPinnedReplyIsReportedBackForItsOwnTopic(): void
    {
        bc_test_install_pro_addon(['comment_pinning']);
        bc_test_pro_pin_comment(self::TOPIC, self::REPLY);

        $this->assertSame(self::REPLY, ProFeatures::pinnedCommentId(self::TOPIC));
    }

    /**
     * A pin belongs to one topic. Answering another topic's question with it
     * would lift a reply that is not in that thread at all.
     */
    public function testAPinDoesNotLeakToAnotherTopic(): void
    {
        bc_test_install_pro_addon(['comment_pinning']);
        bc_test_pro_pin_comment(self::TOPIC, self::REPLY);

        $this->assertSame(0, ProFeatures::pinnedCommentId(self::TOPIC + 1));
    }

    /**
     * One pin per topic, and the storage shape is what enforces it: pinning a
     * second reply is a write to the same key, not a second row.
     */
    public function testPinningASecondReplyReplacesTheFirst(): void
    {
        bc_test_install_pro_addon(['comment_pinning']);
        bc_test_pro_pin_comment(self::TOPIC, self::REPLY);
        bc_test_pro_pin_comment(self::TOPIC, self::REPLY + 1);

        $this->assertSame(self::REPLY + 1, ProFeatures::pinnedCommentId(self::TOPIC));
    }

    public function testUnpinningLeavesTheTopicWithNoPin(): void
    {
        bc_test_install_pro_addon(['comment_pinning']);
        bc_test_pro_pin_comment(self::TOPIC, self::REPLY);
        bc_test_pro_pin_comment(self::TOPIC, 0);

        $this->assertSame(0, ProFeatures::pinnedCommentId(self::TOPIC));
    }
}
