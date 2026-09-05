<?php

namespace BitApps\BitConnect\Tests\Services;

use BitApps\BitConnect\Enum\ReportReasons;
use BitApps\BitConnect\Enum\ReportStatus;
use PHPUnit\Framework\TestCase;

/**
 * The rules that decide what a report means, with no database in sight.
 *
 * These are small, and that is the point: what a status does to the content is
 * the difference between reporting something and being able to bury it, and it
 * is decided by two functions that nothing was checking.
 *
 * @internal
 *
 * @coversNothing
 */
class ReportDecisionsTest extends TestCase
{
    public function testKeepingContentPutsItBack(): void
    {
        $this->assertTrue(ReportStatus::restoresContent(ReportStatus::RESOLVED_KEPT));
    }

    public function testDismissingAReportPutsTheContentBack(): void
    {
        $this->assertTrue(ReportStatus::restoresContent(ReportStatus::DISMISSED));
    }

    /**
     * The asymmetry the three endings exist for. If every ending restored, a
     * removal would undo itself; if none did, reporting something would be
     * enough to bury it for good.
     */
    public function testRemovingContentDoesNotPutItBack(): void
    {
        $this->assertFalse(ReportStatus::restoresContent(ReportStatus::RESOLVED_REMOVED));
    }

    public function testPendingIsNotAnEndingAndDoesNotRestore(): void
    {
        $this->assertFalse(ReportStatus::restoresContent(ReportStatus::PENDING));
        $this->assertNotContains(ReportStatus::PENDING, ReportStatus::closed());
    }

    public function testEveryEndingIsClosedAndThereAreThree(): void
    {
        $closed = ReportStatus::closed();

        $this->assertCount(3, $closed);
        $this->assertContains(ReportStatus::RESOLVED_KEPT, $closed);
        $this->assertContains(ReportStatus::RESOLVED_REMOVED, $closed);
        $this->assertContains(ReportStatus::DISMISSED, $closed);
    }

    public function testEveryCaseIsEitherPendingOrAnEnding(): void
    {
        $accounted = array_merge([ReportStatus::PENDING], ReportStatus::closed());

        $this->assertSame(\count(ReportStatus::cases()), \count($accounted));
    }

    public function testOnlyOtherRequiresTheReporterToExplain(): void
    {
        $this->assertTrue(ReportReasons::requiresDetails(ReportReasons::OTHER));

        foreach (ReportReasons::cases() as $reason) {
            if ($reason === ReportReasons::OTHER) {
                continue;
            }

            $this->assertFalse(
                ReportReasons::requiresDetails($reason),
                $reason->value . ' should stand on its own without an explanation'
            );
        }
    }

    public function testEveryReasonIsOfferedWithALabel(): void
    {
        $options = ReportReasons::options();

        $this->assertCount(\count(ReportReasons::cases()), $options);

        foreach ($options as $option) {
            $this->assertArrayHasKey('value', $option);
            $this->assertArrayHasKey('label', $option);
            $this->assertNotSame('', $option['label'], $option['value'] . ' is offered with no label');
            $this->assertNotSame(
                $option['value'],
                $option['label'],
                $option['value'] . ' falls back to its slug, so the #[Label] is missing'
            );
        }
    }

    public function testLabelsAreKeyedBySlugSoTheQueueCanNameAReason(): void
    {
        $labels = ReportReasons::labels();

        foreach (ReportReasons::cases() as $reason) {
            $this->assertArrayHasKey($reason->value, $labels);
        }
    }
}
