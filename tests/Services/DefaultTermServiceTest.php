<?php

namespace BitApps\BitConnect\Tests\Services;

use BitApps\BitConnect\Services\DefaultTermService;
use BitApps\BitConnect\Services\StageService;
use BitApps\BitConnect\Services\StatusService;
use PHPUnit\Framework\TestCase;
use WP_Term;

/**
 * Pins down how the protected default stage and status are found.
 *
 * Both used to be identified by a reserved slug, which broke the moment an
 * admin renamed one: the term lost its delete protection and new topics landed
 * with no stage at all. A meta flag identifies them instead, so the slug is
 * free to change — these tests are what keep it that way.
 *
 * @internal
 *
 * @coversNothing
 */
final class DefaultTermServiceTest extends TestCase
{
    private const STAGES = 'bit-connect-stages';

    private const STATUSES = 'bit-connect-statuses';

    private const META = 'is_default';

    protected function tearDown(): void
    {
        $GLOBALS['__wp_terms'] = [];
        $GLOBALS['__wp_term_meta'] = [];
    }

    // -----------------------------------------------------------------------
    // Finding the flagged term
    // -----------------------------------------------------------------------

    public function testTheFlaggedTermIsFoundWhateverItsSlugHasBecome(): void
    {
        $this->seedTerm(4, 'renamed-by-an-admin', self::STAGES, flagged: true);

        $found = DefaultTermService::find(self::STAGES, self::META);

        $this->assertInstanceOf(WP_Term::class, $found);
        $this->assertSame(4, $found->term_id);
    }

    public function testATaxonomyWithNothingFlaggedHasNoDefault(): void
    {
        $this->seedTerm(4, 'questions', self::STAGES, flagged: false);

        $this->assertNull(DefaultTermService::find(self::STAGES, self::META));
    }

    /**
     * Stages and statuses share the meta key, so the taxonomy is the only thing
     * separating one default from the other.
     */
    public function testTheFlagIsScopedToItsOwnTaxonomy(): void
    {
        $this->seedTerm(4, 'a-status', self::STATUSES, flagged: true);

        $this->assertNull(DefaultTermService::find(self::STAGES, self::META));
    }

    public function testAnErroringTermQueryLeavesNoDefault(): void
    {
        $this->assertNull(DefaultTermService::find('a-taxonomy-that-has-no-terms', self::META));
    }

    // -----------------------------------------------------------------------
    // Recognising the default
    // -----------------------------------------------------------------------

    public function testAFlaggedTermReportsItselfAsTheDefault(): void
    {
        $term = $this->seedTerm(4, 'questions', self::STAGES, flagged: true);

        $this->assertTrue(DefaultTermService::isDefault($term, self::STAGES, self::META));
    }

    public function testAnUnflaggedTermIsNotTheDefault(): void
    {
        $term = $this->seedTerm(5, 'ideas', self::STAGES, flagged: false);

        $this->assertFalse(DefaultTermService::isDefault($term, self::STAGES, self::META));
    }

    /**
     * A flagged status asked about as a stage is not the stage default, however
     * the meta reads.
     */
    public function testATermOfAnotherTaxonomyIsNeverTheDefault(): void
    {
        $term = $this->seedTerm(6, 'need-approval', self::STATUSES, flagged: true);

        $this->assertFalse(DefaultTermService::isDefault($term, self::STAGES, self::META));
    }

    // -----------------------------------------------------------------------
    // Ensuring one exists
    // -----------------------------------------------------------------------

    public function testAnAlreadyFlaggedDefaultIsLeftAlone(): void
    {
        $this->seedTerm(4, 'renamed', self::STAGES, flagged: true);

        DefaultTermService::ensure(self::STAGES, self::META, 'questions', 'Questions');

        $this->assertCount(1, $GLOBALS['__wp_terms']);
    }

    /**
     * Installs that predate the flag identified their default by slug. That
     * term is adopted rather than a second default being created beside it.
     */
    public function testALegacyTermIsAdoptedRatherThanDuplicated(): void
    {
        $this->seedTerm(4, 'questions', self::STAGES, flagged: false);

        DefaultTermService::ensure(self::STAGES, self::META, 'questions', 'Questions');

        $this->assertCount(1, $GLOBALS['__wp_terms']);
        $this->assertSame(1, $GLOBALS['__wp_term_meta'][4][self::META]);
    }

    public function testAFreshInstallGetsTheDefaultCreatedAndFlagged(): void
    {
        DefaultTermService::ensure(self::STAGES, self::META, 'questions', 'Questions');

        $created = DefaultTermService::find(self::STAGES, self::META);

        $this->assertInstanceOf(WP_Term::class, $created);
        $this->assertSame('questions', $created->slug);
        $this->assertSame('Questions', $created->name);
        $this->assertSame(self::STAGES, $created->taxonomy);
    }

    // -----------------------------------------------------------------------
    // What the stage and status services read off it
    // -----------------------------------------------------------------------

    public function testTheDefaultStageIsReadThroughTheFlag(): void
    {
        $stage = $this->seedTerm(4, 'renamed-stage', self::STAGES, flagged: true);

        $this->assertSame($stage, StageService::defaultStage());
        $this->assertSame('renamed-stage', StageService::defaultStageSlug());
        $this->assertTrue(StageService::isDefault($stage));
    }

    public function testTheDefaultStatusIsReadThroughTheFlag(): void
    {
        $status = $this->seedTerm(9, 'renamed-status', self::STATUSES, flagged: true);

        $this->assertSame($status, StatusService::defaultStatus());
        $this->assertSame('renamed-status', StatusService::defaultStatusSlug());
        $this->assertTrue(StatusService::isDefault($status));
    }

    /**
     * The portal's "awaiting approval" check compares against this slug; an
     * empty string is what tells it there is nothing to compare against.
     */
    public function testAMissingDefaultReportsAnEmptySlugRatherThanFailing(): void
    {
        $this->assertSame('', StageService::defaultStageSlug());
        $this->assertSame('', StatusService::defaultStatusSlug());
    }

    public function testMarkingAStageDefaultFlagsIt(): void
    {
        $stage = $this->seedTerm(4, 'ideas', self::STAGES, flagged: false);

        StageService::markDefault(4);

        $this->assertTrue(StageService::isDefault($stage));
    }

    private function seedTerm(int $termId, string $slug, string $taxonomy, bool $flagged): WP_Term
    {
        $term = new WP_Term();
        $term->term_id = $termId;
        $term->slug = $slug;
        $term->name = $slug;
        $term->taxonomy = $taxonomy;

        $GLOBALS['__wp_terms'][] = $term;

        if ($flagged) {
            $GLOBALS['__wp_term_meta'][$termId][self::META] = '1';
        }

        return $term;
    }
}
