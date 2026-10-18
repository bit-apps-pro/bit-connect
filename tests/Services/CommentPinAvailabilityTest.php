<?php

namespace BitApps\BitConnect\Tests\Services;

use BitApps\BitConnect\Services\ExtensionPoints;
use PHPUnit\Framework\TestCase;

/**
 * What this plugin says about pinning when nothing implements it.
 *
 * The whole of the free half is one extension point that answers 0, and
 * everything downstream — the `pinned` flag on a comment, the lift to the
 * front of the thread — is a consequence of it. So the first case is the one
 * that matters most: if `pinnedCommentId()` ever stops answering 0 by itself,
 * a plugin with no pin action starts claiming replies are pinned.
 *
 * The cases with the add-on installed use the same double every other
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

    public function testNothingIsPinnedWhenNothingCanPin(): void
    {
        $this->assertSame(0, ExtensionPoints::pinnedCommentId(self::TOPIC));
    }

    public function testAPinnedReplyIsReportedBackForItsOwnTopic(): void
    {
        bc_test_pro_pin_comment(self::TOPIC, self::REPLY);

        $this->assertSame(self::REPLY, ExtensionPoints::pinnedCommentId(self::TOPIC));
    }

    /**
     * A pin belongs to one topic. Answering another topic's question with it
     * would lift a reply that is not in that thread at all.
     */
    public function testAPinDoesNotLeakToAnotherTopic(): void
    {
        bc_test_pro_pin_comment(self::TOPIC, self::REPLY);

        $this->assertSame(0, ExtensionPoints::pinnedCommentId(self::TOPIC + 1));
    }

    /**
     * One pin per topic, and the storage shape is what enforces it: pinning a
     * second reply is a write to the same key, not a second row.
     */
    public function testPinningASecondReplyReplacesTheFirst(): void
    {
        bc_test_pro_pin_comment(self::TOPIC, self::REPLY);
        bc_test_pro_pin_comment(self::TOPIC, self::REPLY + 1);

        $this->assertSame(self::REPLY + 1, ExtensionPoints::pinnedCommentId(self::TOPIC));
    }

    public function testUnpinningLeavesTheTopicWithNoPin(): void
    {
        bc_test_pro_pin_comment(self::TOPIC, self::REPLY);
        bc_test_pro_pin_comment(self::TOPIC, 0);

        $this->assertSame(0, ExtensionPoints::pinnedCommentId(self::TOPIC));
    }

    /**
     * Uninstalling the add-on takes its answer with it, whatever meta is left
     * behind: the free plugin reads the filter, never the meta key.
     */
    public function testAPinIsForgottenOnceNothingAnswersForIt(): void
    {
        bc_test_pro_pin_comment(self::TOPIC, self::REPLY);
        bc_test_uninstall_pro_addon();

        $this->assertSame(0, ExtensionPoints::pinnedCommentId(self::TOPIC));
    }
}
