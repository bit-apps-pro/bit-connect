<?php

namespace BitApps\BitConnect\Tests\Services;

use BitApps\BitConnect\Services\StageHistoryService;
use PHPUnit\Framework\TestCase;
use WP_Post;

/**
 * When a topic entered its stage is recorded only when the stage really
 * changes: saving a topic re-sets the stage it already has, and stamping that
 * would make every edit look like a move on the roadmap.
 *
 * @internal
 *
 * @coversNothing
 */
final class StageHistoryServiceTest extends TestCase
{
    private const STAGES = 'bit-connect-stages';

    protected function setUp(): void
    {
        // A topic that exists but was never moved: the edge every test of a
        // move, or of a non-move, starts from.
        $post = new WP_Post();
        $post->ID = 7;
        $post->post_modified_gmt = '2026-08-01 09:30:00';
        $GLOBALS['__wp_posts'][7] = $post;
    }

    protected function tearDown(): void
    {
        $GLOBALS['__wp_post_meta'] = [];
        unset($GLOBALS['__wp_posts'][7]);
    }

    public function testAMoveToAnotherStageIsStamped(): void
    {
        StageHistoryService::onTermsSet(7, ['shipped'], [12], self::STAGES, false, [11]);

        $this->assertMatchesRegularExpression(
            '/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/',
            StageHistoryService::changedAt(7)
        );
    }

    public function testATopicFiledUnderItsFirstStageIsStamped(): void
    {
        StageHistoryService::onTermsSet(7, ['questions'], [11], self::STAGES, false, []);

        $this->assertNotSame('', StageHistoryService::changedAt(7));
    }

    public function testSettingTheSameStageAgainIsNotAMove(): void
    {
        StageHistoryService::onTermsSet(7, ['planned'], ['11'], self::STAGES, false, [11]);

        $this->assertArrayNotHasKey(StageHistoryService::META_CHANGED_AT, $GLOBALS['__wp_post_meta'][7] ?? []);
    }

    public function testAnEarlierStampSurvivesARepeatedSave(): void
    {
        update_post_meta(7, StageHistoryService::META_CHANGED_AT, '2026-09-28 10:00:00');

        StageHistoryService::onTermsSet(7, ['shipped'], [12], self::STAGES, false, [12]);

        $this->assertSame('2026-09-28 10:00:00', StageHistoryService::changedAt(7));
    }

    public function testOtherTaxonomiesAreIgnored(): void
    {
        StageHistoryService::onTermsSet(7, ['api'], [30], 'bit-connect-tags', false, []);

        $this->assertArrayNotHasKey(StageHistoryService::META_CHANGED_AT, $GLOBALS['__wp_post_meta'][7] ?? []);
    }

    public function testATopicWithNoRecordAnswersEmptyAndWritesNothing(): void
    {
        // Reading is what every topic listing does; it must never write. Old
        // topics are dated once by the Bit_Connect_StageDates migration.
        $this->assertSame('', StageHistoryService::changedAt(7));
        $this->assertArrayNotHasKey(StageHistoryService::META_CHANGED_AT, $GLOBALS['__wp_post_meta'][7] ?? []);
    }
}
