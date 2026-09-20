<?php

namespace BitApps\BitConnect\Tests\Services;

use BitApps\BitConnect\Services\ExtensionPoints;
use PHPUnit\Framework\TestCase;
use WP_Comment;

/**
 * Pins down the extension point that offers an ordering this plugin cannot do.
 *
 * This plugin sorts a thread by date, either way round, and that is every
 * ordering it can perform — ordering by upvotes on replies needs upvotes on
 * replies, which it does not implement. Rather than quietly treating an
 * unknown ordering as "newest", which is a sort control that does nothing, it
 * asks.
 *
 * The valuable case is the last one. A listener that dropped or invented a
 * comment would lose part of a thread with no error anywhere, so the answer is
 * checked for shape rather than trusted, and a bad one falls back to the date
 * ordering instead of being rendered.
 *
 * @internal
 *
 * @coversNothing
 */
final class OrderedCommentsTest extends TestCase
{
    protected function setUp(): void
    {
        $GLOBALS['__wp_filters'] = [];
    }

    protected function tearDown(): void
    {
        $GLOBALS['__wp_filters'] = [];
    }

    public function testWithNobodyListeningTheCallerSortsByDate(): void
    {
        $this->assertNull(ExtensionPoints::orderedComments([$this->comment(1)], 'mostVoted'));
    }

    public function testAListenerThatDeclinesLeavesTheDateOrdering(): void
    {
        $GLOBALS['__wp_filters']['bit_connect_ordered_comments'] = static fn($ordered) => $ordered;

        $this->assertNull(ExtensionPoints::orderedComments([$this->comment(1)], 'mostVoted'));
    }

    public function testAListenersOrderIsUsed(): void
    {
        $first = $this->comment(1);
        $second = $this->comment(2);

        $GLOBALS['__wp_filters']['bit_connect_ordered_comments'] =
            static fn($_ordered, $comments) => array_reverse($comments);

        $ordered = ExtensionPoints::orderedComments([$first, $second], 'mostVoted');

        $this->assertSame([2, 1], array_map(static fn($c): int => (int) $c->comment_ID, $ordered));
    }

    /**
     * A thread comes back whole or not at all.
     */
    public function testAnAnswerThatLostACommentIsDiscarded(): void
    {
        $GLOBALS['__wp_filters']['bit_connect_ordered_comments'] =
            static fn($_ordered, $comments) => [$comments[0]];

        $this->assertNull(
            ExtensionPoints::orderedComments([$this->comment(1), $this->comment(2)], 'mostVoted')
        );
    }

    public function testAnAnswerThatIsNotAListIsDiscarded(): void
    {
        $GLOBALS['__wp_filters']['bit_connect_ordered_comments'] = 'not an array';

        $this->assertNull(ExtensionPoints::orderedComments([$this->comment(1)], 'mostVoted'));
    }

    private function comment(int $id): WP_Comment
    {
        $comment = new WP_Comment();
        $comment->comment_ID = $id;
        $comment->comment_date = '2026-01-0' . $id . '00:00:00';

        return $comment;
    }
}
