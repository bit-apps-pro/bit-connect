<?php

namespace BitApps\BitConnect\Tests\Services;

use BitApps\BitConnect\Enum\Taxonomies;
use BitApps\BitConnect\Services\TermOrderService;
use PHPUnit\Framework\TestCase;
use WP_Term;

/**
 * Pins down the admin-defined ordering of taxonomy terms.
 *
 * The order is the one an admin dragged into place, and both frontends and the
 * SSR pass render from it. Getting it wrong does not fail loudly: the lists
 * simply come back in a different order than the admin arranged, which reads as
 * a UI bug nobody can trace back to here.
 *
 * @internal
 *
 * @coversNothing
 */
final class TermOrderServiceTest extends TestCase
{
    private const STAGES = 'bit-connect-stages';

    protected function tearDown(): void
    {
        $GLOBALS['__wp_terms'] = [];
        $GLOBALS['__wp_term_meta'] = [];
    }

    // -----------------------------------------------------------------------
    // Which taxonomies can be ordered
    // -----------------------------------------------------------------------

    public function testStagesStatusesTypesAndDepartmentsAreOrderable(): void
    {
        foreach ([Taxonomies::STAGES, Taxonomies::STATUSES, Taxonomies::TOPIC_TYPES, Taxonomies::DEPARTMENTS] as $taxonomy) {
            $this->assertTrue(TermOrderService::isOrderable($taxonomy->value), $taxonomy->value . ' should be orderable');
        }
    }

    /**
     * Tags order by usage, so an admin curating them by hand is not offered.
     */
    public function testTagsAreNotOrderable(): void
    {
        $this->assertFalse(TermOrderService::isOrderable(Taxonomies::TAGS->value));
    }

    public function testAnUnknownTaxonomyIsNotOrderable(): void
    {
        $this->assertFalse(TermOrderService::isOrderable('category'));
    }

    // -----------------------------------------------------------------------
    // Sorting
    // -----------------------------------------------------------------------

    public function testTermsComeBackInTheStoredOrderRatherThanTheStoredSequence(): void
    {
        $this->seedTerm(7, 'gamma', 0);
        $this->seedTerm(3, 'alpha', 1);
        $this->seedTerm(5, 'beta', 2);

        $this->assertSame(['gamma', 'alpha', 'beta'], $this->slugsOf(TermOrderService::ordered(self::STAGES)));
    }

    /**
     * A term created after the last reorder has no position of its own; it goes
     * behind everything that does rather than jumping to the front on a zero.
     */
    public function testATermThatHasNeverBeenOrderedSortsLast(): void
    {
        $this->seedTerm(4, 'ordered-second', 1);
        $this->seedTerm(9, 'brand-new', null);
        $this->seedTerm(2, 'ordered-first', 0);

        $this->assertSame(['ordered-first', 'ordered-second', 'brand-new'], $this->slugsOf(TermOrderService::ordered(self::STAGES)));
    }

    /**
     * Before any reorder that leaves the list ordered by term id, which is the
     * order these lists have always come back in.
     */
    public function testUnorderedTermsFallBackToOldestFirst(): void
    {
        $this->seedTerm(12, 'newest', null);
        $this->seedTerm(4, 'oldest', null);
        $this->seedTerm(8, 'middle', null);

        $this->assertSame(['oldest', 'middle', 'newest'], $this->slugsOf(TermOrderService::ordered(self::STAGES)));
    }

    public function testTermsSharingAPositionAreSeparatedByTermId(): void
    {
        $this->seedTerm(11, 'later', 3);
        $this->seedTerm(6, 'earlier', 3);

        $this->assertSame(['earlier', 'later'], $this->slugsOf(TermOrderService::sort($GLOBALS['__wp_terms'])));
    }

    /**
     * A stored zero is a real position, not the absence of one.
     */
    public function testPositionZeroIsAPositionAndNotATermWithoutOne(): void
    {
        $this->seedTerm(30, 'first', 0);
        $this->seedTerm(10, 'unordered', null);

        $this->assertSame(['first', 'unordered'], $this->slugsOf(TermOrderService::ordered(self::STAGES)));
    }

    public function testOnlyTheAskedForTaxonomyIsReturned(): void
    {
        $this->seedTerm(1, 'a-stage', 0);
        $this->seedTerm(2, 'a-status', 0, 'bit-connect-statuses');

        $this->assertSame(['a-stage'], $this->slugsOf(TermOrderService::ordered(self::STAGES)));
    }

    public function testATaxonomyWithNoTermsComesBackEmpty(): void
    {
        $this->assertSame([], TermOrderService::ordered(self::STAGES));
    }

    // -----------------------------------------------------------------------
    // Reordering
    // -----------------------------------------------------------------------

    public function testReorderPersistsTheRequestedSequenceFromZero(): void
    {
        $this->seedTerm(1, 'one', 0);
        $this->seedTerm(2, 'two', 1);
        $this->seedTerm(3, 'three', 2);

        $reordered = TermOrderService::reorder(self::STAGES, [3, 1, 2]);

        $this->assertSame(['three', 'one', 'two'], $this->slugsOf($reordered));
        $this->assertSame(0, $GLOBALS['__wp_term_meta'][3][TermOrderService::ORDER_META_KEY]);
        $this->assertSame(1, $GLOBALS['__wp_term_meta'][1][TermOrderService::ORDER_META_KEY]);
        $this->assertSame(2, $GLOBALS['__wp_term_meta'][2][TermOrderService::ORDER_META_KEY]);
    }

    /**
     * A client that has not seen a newly created term sends a list without it.
     * That term keeps its place behind the ones that were sent rather than
     * scrambling them.
     */
    public function testATermMissingFromTheRequestIsAppendedRatherThanDropped(): void
    {
        $this->seedTerm(1, 'one', 0);
        $this->seedTerm(2, 'two', 1);
        $this->seedTerm(3, 'created-since', null);

        $reordered = TermOrderService::reorder(self::STAGES, [2, 1]);

        $this->assertSame(['two', 'one', 'created-since'], $this->slugsOf($reordered));
        $this->assertSame(2, $GLOBALS['__wp_term_meta'][3][TermOrderService::ORDER_META_KEY]);
    }

    public function testIdsFromAnotherTaxonomyAreIgnored(): void
    {
        $this->seedTerm(1, 'one', 0);
        $this->seedTerm(2, 'two', 1);
        $this->seedTerm(99, 'a-status', 0, 'bit-connect-statuses');

        $reordered = TermOrderService::reorder(self::STAGES, [99, 2, 1]);

        $this->assertSame(['two', 'one'], $this->slugsOf($reordered));
        $this->assertSame(0, $GLOBALS['__wp_term_meta'][2][TermOrderService::ORDER_META_KEY]);
    }

    public function testIdsArrivingAsStringsStillMatchTheirTerms(): void
    {
        $this->seedTerm(1, 'one', 0);
        $this->seedTerm(2, 'two', 1);

        $reordered = TermOrderService::reorder(self::STAGES, ['2', '1']);

        $this->assertSame(['two', 'one'], $this->slugsOf($reordered));
    }

    public function testAnEmptyRequestLeavesTheListInItsCurrentOrder(): void
    {
        $this->seedTerm(1, 'one', 0);
        $this->seedTerm(2, 'two', 1);

        $this->assertSame(['one', 'two'], $this->slugsOf(TermOrderService::reorder(self::STAGES, [])));
    }

    // -----------------------------------------------------------------------
    // Helpers
    // -----------------------------------------------------------------------

    private function seedTerm(int $termId, string $slug, ?int $order, string $taxonomy = self::STAGES): void
    {
        $term = new WP_Term();
        $term->term_id = $termId;
        $term->slug = $slug;
        $term->name = $slug;
        $term->taxonomy = $taxonomy;

        $GLOBALS['__wp_terms'][] = $term;

        if ($order !== null) {
            $GLOBALS['__wp_term_meta'][$termId][TermOrderService::ORDER_META_KEY] = $order;
        }
    }

    /**
     * @param WP_Term[] $terms
     *
     * @return string[]
     */
    private function slugsOf(array $terms): array
    {
        return array_map(static fn ($term) => $term->slug, $terms);
    }
}
