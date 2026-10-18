<?php

namespace BitApps\BitConnect\Tests\Services;

use BitApps\BitConnect\Enum\Taxonomies;
use BitApps\BitConnect\Model\Follow;
use BitApps\BitConnect\Services\FollowService;
use PHPUnit\Framework\TestCase;

/**
 * Follows that outlive the thing they point at.
 *
 * A term id WordPress has deleted is a term id it will hand out again. A
 * follow row left pointing at it would make the old tag's followers the new
 * tag's audience, which nobody chose. So a deleted tag takes its rows with it,
 * and a merged one hands them on.
 *
 * @internal
 *
 * @coversNothing
 */
final class FollowRetargetTest extends TestCase
{
    protected function setUp(): void
    {
        $GLOBALS['__bc_follows'] = [
            ['user_id' => 1, 'target_type' => Follow::TARGET_TAG, 'target_id' => 5],
            ['user_id' => 2, 'target_type' => Follow::TARGET_TAG, 'target_id' => 5],
            ['user_id' => 2, 'target_type' => Follow::TARGET_TOPIC, 'target_id' => 5],
            ['user_id' => 3, 'target_type' => Follow::TARGET_TAG, 'target_id' => 6],
        ];
        $GLOBALS['__wpdb_calls'] = [];
        $GLOBALS['wpdb']->failWrites = false;
    }

    protected function tearDown(): void
    {
        $GLOBALS['__bc_follows'] = [];
        $GLOBALS['__wpdb_calls'] = [];
        $GLOBALS['wpdb']->failWrites = false;
    }

    public function testDeletingATagDropsItsFollowsAndNothingElse(): void
    {
        FollowService::onTermDeleted(5, 50, Taxonomies::TAGS->value);

        $this->assertSame([], Follow::userIdsFor(Follow::TARGET_TAG, 5));
        // A topic that happens to share the id is a different thing.
        $this->assertSame([2], Follow::userIdsFor(Follow::TARGET_TOPIC, 5));
        $this->assertSame([3], Follow::userIdsFor(Follow::TARGET_TAG, 6));
    }

    public function testDeletingATermOfAnUnfollowableTaxonomyTouchesNothing(): void
    {
        FollowService::onTermDeleted(5, 50, Taxonomies::STAGES->value);

        $this->assertSame([1, 2], Follow::userIdsFor(Follow::TARGET_TAG, 5));
        $this->assertSame([], $GLOBALS['__wpdb_calls']);
    }

    public function testRetargetMovesEveryRowAndReportsHowMany(): void
    {
        $this->assertSame(2, FollowService::retarget(Follow::TARGET_TAG, 5, 6));

        $this->assertSame([], Follow::userIdsFor(Follow::TARGET_TAG, 5));
        $this->assertSame([1, 2, 3], Follow::userIdsFor(Follow::TARGET_TAG, 6));
        $this->assertSame([2], Follow::userIdsFor(Follow::TARGET_TOPIC, 5));
    }

    public function testRetargetKeepsTheRowAMemberAlreadyHasOnTheDestination(): void
    {
        $GLOBALS['__bc_follows'][] = ['user_id' => 1, 'target_type' => Follow::TARGET_TAG, 'target_id' => 6, 'muted' => 1];

        $this->assertSame(1, FollowService::retarget(Follow::TARGET_TAG, 5, 6));

        $rows = array_values(array_filter(
            $GLOBALS['__bc_follows'],
            static fn (array $row): bool => (int) $row['user_id'] === 1 && $row['target_type'] === Follow::TARGET_TAG
        ));

        $this->assertCount(1, $rows);
        $this->assertSame(6, (int) $rows[0]['target_id']);
        $this->assertSame(1, (int) $rows[0]['muted']);
    }

    public function testRetargetingOntoItselfIsANoOp(): void
    {
        $this->assertSame(0, FollowService::retarget(Follow::TARGET_TAG, 5, 5));
        $this->assertSame([], $GLOBALS['__wpdb_calls']);
    }

    public function testTheTaxonomyAnswerIsOneAnswer(): void
    {
        $this->assertSame(Follow::TARGET_TAG, FollowService::targetTypeForTaxonomy(Taxonomies::TAGS->value));
        $this->assertSame('', FollowService::targetTypeForTaxonomy(Taxonomies::STAGES->value));
        $this->assertSame('', FollowService::targetTypeForTaxonomy('something-else'));
    }
}
