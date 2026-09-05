<?php

namespace BitApps\BitConnect\Tests\Services;

use BitApps\BitConnect\Config;
use BitApps\BitConnect\Services\UserStatsService;
use PHPUnit\Framework\TestCase;
use WP_User;

/**
 * The totals on a member's profile card, and how long they are trusted.
 *
 * Three counts, each a table scan, rendered on a page anyone can open by
 * following a byline — so they are cached, and the cache is dropped whenever
 * something happens to the member rather than expiring on a timer alone. The
 * counting itself is SQL; what is pinned here is everything around it, which is
 * where a stale card or a scan on every page load comes from.
 *
 * @internal
 *
 * @coversNothing
 */
final class UserStatsCacheTest extends TestCase
{
    private const MEMBER = 7;

    private UserStatsService $stats;

    protected function setUp(): void
    {
        $this->stats = new UserStatsService();

        $GLOBALS['__wp_users'] = [];
        $GLOBALS['__wp_transients'] = [];
        $GLOBALS['__wpdb_calls'] = [];
        $GLOBALS['__wpdb_get_var'] = '2';

        $this->seedMember(self::MEMBER, '2026-01-05 08:00:00');
    }

    protected function tearDown(): void
    {
        $GLOBALS['__wp_users'] = [];
        $GLOBALS['__wp_transients'] = [];

        unset($GLOBALS['__wpdb_get_var']);
    }

    public function testAMembersTotalsAreCountedAndReported(): void
    {
        $stats = $this->stats->forUser(self::MEMBER);

        $this->assertSame(2, $stats['topics']);
        $this->assertSame(2, $stats['comments']);
        $this->assertSame(4, $stats['votes_received']);
        $this->assertSame('2026-01-05 08:00:00', $stats['registered_at']);
    }

    /**
     * A card anyone can open by following a byline must not run three table
     * scans on every visit.
     */
    public function testTheTotalsAreCountedOnceAndCachedAfterwards(): void
    {
        $this->stats->forUser(self::MEMBER);
        $queriesAfterFirst = \count($GLOBALS['__wpdb_calls']);

        $this->stats->forUser(self::MEMBER);

        $this->assertSame($queriesAfterFirst, \count($GLOBALS['__wpdb_calls']));
    }

    public function testTheCachedTotalsAreTheOnesReported(): void
    {
        $this->stats->forUser(self::MEMBER);

        $GLOBALS['__wpdb_get_var'] = '99';

        $this->assertSame(2, $this->stats->forUser(self::MEMBER)['topics']);
    }

    /**
     * Dropped whenever something happens to the member — posting, or receiving
     * a vote — rather than left to expire, which is what keeps the card honest
     * without shortening the cache for everybody.
     */
    public function testDroppingTheCacheMakesTheNextReadCountAgain(): void
    {
        $this->stats->forUser(self::MEMBER);

        UserStatsService::forget(self::MEMBER);
        $GLOBALS['__wpdb_get_var'] = '5';

        $this->assertSame(5, $this->stats->forUser(self::MEMBER)['topics']);
    }

    /**
     * WP_Post::$post_author and WP_Comment::$user_id are both numeric strings,
     * so both spellings have to reach the same cache entry.
     */
    public function testTheCacheIsDroppedWhicheverWayTheIdIsSpelled(): void
    {
        $this->stats->forUser(self::MEMBER);

        UserStatsService::forget((string) self::MEMBER);

        $this->assertFalse(get_transient(Config::VAR_PREFIX . 'user_stats_' . self::MEMBER));
    }

    /**
     * One entry per member: dropping one member's card must not cost every
     * other member theirs.
     */
    public function testEachMembersTotalsAreCachedSeparately(): void
    {
        $this->seedMember(8, '2026-02-01 08:00:00');

        $this->stats->forUser(self::MEMBER);
        $this->stats->forUser(8);

        UserStatsService::forget(self::MEMBER);

        $this->assertFalse(get_transient(Config::VAR_PREFIX . 'user_stats_' . self::MEMBER));
        $this->assertIsArray(get_transient(Config::VAR_PREFIX . 'user_stats_8'));
    }

    public function testAnAccountThatIsGoneHasNoTotalsAndCostsNoQueries(): void
    {
        $this->assertNull($this->stats->forUser(404));
        $this->assertSame([], $GLOBALS['__wpdb_calls']);
    }

    public function testNobodyHasNoTotals(): void
    {
        $this->assertNull($this->stats->forUser(0));
    }

    private function seedMember(int $userId, string $registeredAt): void
    {
        $user = new WP_User();
        $user->ID = $userId;
        $user->display_name = 'Member ' . $userId;
        $user->user_registered = $registeredAt;

        $GLOBALS['__wp_users'][$userId] = $user;
    }
}
