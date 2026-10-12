<?php

namespace BitApps\BitConnect\Tests\Services;

use BitApps\BitConnect\Services\TopicService;
use PHPUnit\Framework\TestCase;
use WP_Query;

/**
 * Topics ordered by their cached vote count.
 *
 * Counted from the votes table, as each card's own total is — the cached
 * count in post meta is absent on most topics. A topic nobody has voted on
 * must still be listed, last, rather than dropped by the join.
 *
 * @internal
 *
 * @coversNothing
 */
final class TopicVoteOrderTest extends TestCase
{
    private const CLAUSES = ['join' => '', 'orderby' => 'wp_posts.post_date DESC', 'where' => ''];

    public function testAQueryAskingForVoteOrderJoinsEachTopicsVoteCount(): void
    {
        $clauses = TopicService::voteOrderClauses(self::CLAUSES, $this->query(['bit_connect_vote_order' => true]));

        $this->assertStringContainsString('LEFT JOIN (SELECT post_id, COUNT(*) AS total FROM wp_bit_connect_votes', $clauses['join']);
        $this->assertStringContainsString('GROUP BY post_id) AS bc_votes ON (bc_votes.post_id = wp_posts.ID)', $clauses['join']);
    }

    public function testMostVotesComeFirstThenNewest(): void
    {
        $clauses = TopicService::voteOrderClauses(self::CLAUSES, $this->query(['bit_connect_vote_order' => true]));

        $this->assertStringStartsWith('COALESCE(bc_votes.total, 0) DESC', $clauses['orderby']);
        $this->assertStringContainsString('wp_posts.post_date DESC', $clauses['orderby']);
    }

    public function testEveryOtherQueryIsLeftAlone(): void
    {
        $this->assertSame(self::CLAUSES, TopicService::voteOrderClauses(self::CLAUSES, $this->query([])));
    }

    /**
     * @param array<string, mixed> $vars
     */
    private function query(array $vars): WP_Query
    {
        return new class($vars) extends WP_Query {
            /** @param array<string, mixed> $vars */
            public function __construct(private array $vars) {}

            /** @return mixed */
            public function get($key, $default = '')
            {
                return $this->vars[$key] ?? $default;
            }
        };
    }
}
