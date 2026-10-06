<?php

namespace BitApps\BitConnect\Tests\Services;

use BitApps\BitConnect\Enum\Taxonomies;
use BitApps\BitConnect\Model\Follow;
use BitApps\BitConnect\Services\FollowService;
use BitApps\BitConnect\Services\TermMergeService;
use PHPUnit\Framework\TestCase;
use WP_Term;

/**
 * Folding one tag into another.
 *
 * The order of operations is the point: topics are re-filed under the survivor
 * before anything is deleted, and followers are moved before the term goes,
 * because deleting a term purges whatever still follows it. A merge that
 * deleted first would be a delete with extra steps.
 *
 * @internal
 *
 * @coversNothing
 */
final class TermMergeServiceTest extends TestCase
{
    private const TAGS = Taxonomies::TAGS->value;

    private const WP = 11;

    private const WORDPRESS = 12;

    private const OTHER = 13;

    protected function setUp(): void
    {
        $GLOBALS['__wp_terms'] = [
            $this->term(self::WP, 'wp', self::TAGS),
            $this->term(self::WORDPRESS, 'wordpress', self::TAGS),
            $this->term(self::OTHER, 'billing', Taxonomies::TOPIC_TYPES->value),
        ];
        $GLOBALS['__wp_post_terms'] = [
            101 => [self::TAGS => [self::WP]],
            102 => [self::TAGS => [self::WP, self::WORDPRESS]],
            103 => [self::TAGS => [self::WORDPRESS]],
            104 => [self::TAGS => [self::WP, 99]],
        ];
        $GLOBALS['__bc_follows'] = [
            ['user_id' => 1, 'target_type' => Follow::TARGET_TAG, 'target_id' => self::WP],
            ['user_id' => 2, 'target_type' => Follow::TARGET_TAG, 'target_id' => self::WP, 'muted' => 1],
            ['user_id' => 2, 'target_type' => Follow::TARGET_TAG, 'target_id' => self::WORDPRESS],
            ['user_id' => 3, 'target_type' => Follow::TARGET_TAG, 'target_id' => self::WORDPRESS],
        ];
        $GLOBALS['__wpdb_calls'] = [];
        $GLOBALS['wpdb']->failWrites = false;
    }

    protected function tearDown(): void
    {
        $GLOBALS['__wp_terms'] = [];
        $GLOBALS['__wp_post_terms'] = [];
        $GLOBALS['__bc_follows'] = [];
        $GLOBALS['__wpdb_calls'] = [];
    }

    public function testTopicsAreRefiledUnderTheSurvivorAndTheSourceGoes(): void
    {
        $result = TermMergeService::merge(self::TAGS, self::WP, self::WORDPRESS);

        $this->assertSame(['moved' => 3, 'followers' => 1], $result);

        $filed = static fn (int $postId): array => $GLOBALS['__wp_post_terms'][$postId][self::TAGS];

        $this->assertSame([self::WORDPRESS], $filed(101));
        // Already carried the survivor: not doubled.
        $this->assertSame([self::WORDPRESS], $filed(102));
        $this->assertSame([self::WORDPRESS], $filed(103));
        // Keeps its other tag.
        $this->assertSame([99, self::WORDPRESS], $filed(104));

        $this->assertNull(get_term(self::WP));
        $this->assertNotNull(get_term(self::WORDPRESS));
    }

    public function testFollowersMoveAcrossWithoutDoublingUp(): void
    {
        TermMergeService::merge(self::TAGS, self::WP, self::WORDPRESS);

        $this->assertSame([], Follow::userIdsFor(Follow::TARGET_TAG, self::WP));
        $survivors = Follow::userIdsFor(Follow::TARGET_TAG, self::WORDPRESS);
        sort($survivors);
        $this->assertSame([1, 2, 3], $survivors);

        // Member 2 muted the source but follows the survivor. The row on the
        // survivor is the one that stands: a decision about "wordpress" was
        // made about "wordpress".
        $this->assertSame(
            ['following' => true, 'muted' => false],
            \array_slice(FollowService::stateFor(2, Follow::TARGET_TAG, self::WORDPRESS), 0, 2)
        );
        $this->assertCount(3, $GLOBALS['__bc_follows']);
    }

    public function testOnlyTagsMerge(): void
    {
        $result = TermMergeService::merge(Taxonomies::TOPIC_TYPES->value, self::OTHER, self::WP);

        $this->assertTrue(is_wp_error($result));
        $this->assertSame('bit_connect_term_not_mergeable', $result->get_error_code());
        $this->assertNotNull(get_term(self::OTHER));
    }

    public function testATagCannotBeMergedIntoItself(): void
    {
        $result = TermMergeService::merge(self::TAGS, self::WP, self::WP);

        $this->assertTrue(is_wp_error($result));
        $this->assertNotNull(get_term(self::WP));
        $this->assertSame([self::WP], $GLOBALS['__wp_post_terms'][101][self::TAGS]);
    }

    public function testATermOfAnotherTaxonomyIsNotATag(): void
    {
        // Exists, but as a topic type: get_term() alone would find it.
        $result = TermMergeService::merge(self::TAGS, self::WP, self::OTHER);

        $this->assertTrue(is_wp_error($result));
        $this->assertSame('bit_connect_term_unknown', $result->get_error_code());
        $this->assertNotNull(get_term(self::WP));
    }

    public function testAMissingTermIsRefusedBeforeAnythingMoves(): void
    {
        $result = TermMergeService::merge(self::TAGS, self::WP, 404);

        $this->assertTrue(is_wp_error($result));
        $this->assertSame([self::WP], $GLOBALS['__wp_post_terms'][101][self::TAGS]);
        $this->assertSame([], $GLOBALS['__wpdb_calls']);
    }

    private function term(int $id, string $slug, string $taxonomy): WP_Term
    {
        $term = new WP_Term();
        $term->term_id = $id;
        $term->slug = $slug;
        $term->name = ucfirst($slug);
        $term->taxonomy = $taxonomy;
        $term->description = '';

        return $term;
    }
}
