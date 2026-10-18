<?php

namespace BitApps\BitConnect\Tests\Services;

use BitApps\BitConnect\Enum\ActivityActions;
use BitApps\BitConnect\Services\ActivityLogService;
use BitApps\BitConnect\Services\ExtensionPoints;
use PHPUnit\Framework\TestCase;

/**
 * Pins down what reaches the activity log and what does not.
 *
 * One rule decides it: log only when the actor is not the author. A member
 * editing their own reply needs no row — the "(edited)" note already says so —
 * and recording every self-edit would bury the handful of rows a moderator
 * actually arrives looking for. A missing row and a spurious one are both
 * silent, which is why the rule is asserted here rather than trusted at six
 * call sites.
 *
 * @internal
 *
 * @coversNothing
 */
final class ActivityLogServiceTest extends TestCase
{
    private const MODERATOR = 7;

    private const AUTHOR = 3;

    protected function setUp(): void
    {
        $GLOBALS['__bc_activity_log'] = [];
        $GLOBALS['__wp_current_user_id'] = self::MODERATOR;
    }

    protected function tearDown(): void
    {
        $GLOBALS['__bc_activity_log'] = [];
        $GLOBALS['__wp_current_user_id'] = 0;
        unset($GLOBALS['__wp_filters']['bit_connect_activity_actions']);
    }

    // -----------------------------------------------------------------------
    // Recording
    // -----------------------------------------------------------------------

    public function testAnActionIsRecordedAgainstTheCurrentUser(): void
    {
        ActivityLogService::record(ActivityActions::HIDE, ActivityLogService::TARGET_POST, 10, self::AUTHOR);

        $row = $this->onlyRow();

        $this->assertSame(self::MODERATOR, $row['actor_id']);
        $this->assertSame('hide', $row['action']);
        $this->assertSame('post', $row['target_type']);
        $this->assertSame(10, $row['target_id']);
        $this->assertSame(self::AUTHOR, $row['target_author']);
    }

    public function testAReasonAndContextAreCarriedOntoTheRow(): void
    {
        ActivityLogService::record(
            ActivityActions::DELETE_COMMENT,
            ActivityLogService::TARGET_COMMENT,
            20,
            self::AUTHOR,
            ['replies_lost' => 2],
            'Spam'
        );

        $row = $this->onlyRow();

        $this->assertSame('Spam', $row['reason']);
        $this->assertSame(['replies_lost' => 2], json_decode($row['context'], true));
    }

    /**
     * An empty blob is stored as null rather than as "[]", so the column reads
     * as "nothing was recorded" instead of "an empty something was".
     */
    public function testAnEmptyContextIsStoredAsNothing(): void
    {
        ActivityLogService::record(ActivityActions::LOCK_POST, ActivityLogService::TARGET_POST, 10, self::AUTHOR);

        $this->assertNull($this->onlyRow()['context']);
    }

    /**
     * Nothing reaches the log by forgetting to log in: a row with no actor can
     * only be written deliberately, through recordAsSystem().
     */
    public function testAnActionWithNobodyBehindItIsNotRecorded(): void
    {
        $GLOBALS['__wp_current_user_id'] = 0;

        ActivityLogService::record(ActivityActions::HIDE, ActivityLogService::TARGET_POST, 10, self::AUTHOR);

        $this->assertSame([], $GLOBALS['__bc_activity_log']);
    }

    public function testAnActionAgainstNothingIsNotRecorded(): void
    {
        ActivityLogService::record(ActivityActions::HIDE, ActivityLogService::TARGET_POST, 0, self::AUTHOR);

        $this->assertSame([], $GLOBALS['__bc_activity_log']);
    }

    // -----------------------------------------------------------------------
    // Another plugin's actions
    // -----------------------------------------------------------------------

    public function testAnActionAnotherPluginNamedIsRecordedUnderItsSlug(): void
    {
        $GLOBALS['__wp_filters']['bit_connect_activity_actions'] = ['feature_post' => 'Featured a topic'];

        ActivityLogService::record('feature_post', ActivityLogService::TARGET_POST, 10, self::AUTHOR);

        $this->assertSame('feature_post', $this->onlyRow()['action']);
    }

    /**
     * A slug nobody named would be a row the log cannot label, written by a
     * caller that misspelt it.
     */
    public function testASlugNobodyNamedIsNotRecorded(): void
    {
        ActivityLogService::record('feature_post', ActivityLogService::TARGET_POST, 10, self::AUTHOR);

        $this->assertSame([], $GLOBALS['__bc_activity_log']);
    }

    public function testAnotherPluginCannotTakeOverOneOfThisPluginsSlugs(): void
    {
        $GLOBALS['__wp_filters']['bit_connect_activity_actions'] = ['hide' => 'Something else', 'feature_post' => 'Featured a topic'];

        $this->assertSame(['feature_post' => 'Featured a topic'], ExtensionPoints::activityActions());
    }

    // -----------------------------------------------------------------------
    // Actions nobody chose
    // -----------------------------------------------------------------------

    /**
     * A report crossing the auto-hide threshold is the case this exists for.
     * Recording it against the reporter would read as though they exercised a
     * power they do not have.
     */
    public function testTheAutoHideIsRecordedAgainstNobodyRatherThanTheReporter(): void
    {
        ActivityLogService::recordAsSystem(
            ActivityActions::HIDE,
            ActivityLogService::TARGET_POST,
            10,
            self::AUTHOR,
            ['threshold' => 2]
        );

        $this->assertSame(ActivityLogService::SYSTEM_ACTOR, $this->onlyRow()['actor_id']);
    }

    public function testASystemRowIsWrittenEvenWithNobodyLoggedIn(): void
    {
        $GLOBALS['__wp_current_user_id'] = 0;

        ActivityLogService::recordAsSystem(ActivityActions::HIDE, ActivityLogService::TARGET_POST, 10, self::AUTHOR);

        $this->assertCount(1, $GLOBALS['__bc_activity_log']);
    }

    public function testASystemRowStillNeedsSomethingToPointAt(): void
    {
        ActivityLogService::recordAsSystem(ActivityActions::HIDE, ActivityLogService::TARGET_POST, 0, self::AUTHOR);

        $this->assertSame([], $GLOBALS['__bc_activity_log']);
    }

    // -----------------------------------------------------------------------
    // The rule every call site follows
    // -----------------------------------------------------------------------

    public function testEditingSomeoneElsesWordsIsRecorded(): void
    {
        ActivityLogService::recordIfNotAuthor(
            ActivityActions::DELETE_COMMENT,
            ActivityLogService::TARGET_COMMENT,
            20,
            self::AUTHOR
        );

        $this->assertCount(1, $GLOBALS['__bc_activity_log']);
    }

    public function testEditingYourOwnWordsIsNotRecorded(): void
    {
        ActivityLogService::recordIfNotAuthor(
            ActivityActions::DELETE_COMMENT,
            ActivityLogService::TARGET_COMMENT,
            20,
            self::MODERATOR
        );

        $this->assertSame([], $GLOBALS['__bc_activity_log']);
    }

    /**
     * Content with no author — the id zero — is not the same as content written
     * by the logged-out visitor, so it must not be silently treated as self-
     * authored when nobody is logged in.
     */
    public function testAnAuthorlessTargetIsNotRecordedForALoggedOutActor(): void
    {
        $GLOBALS['__wp_current_user_id'] = 0;

        ActivityLogService::recordIfNotAuthor(ActivityActions::HIDE, ActivityLogService::TARGET_POST, 10, 0);

        $this->assertSame([], $GLOBALS['__bc_activity_log']);
    }

    // -----------------------------------------------------------------------
    // Excerpting
    // -----------------------------------------------------------------------

    public function testShortTextIsKeptWholeAndUnmarked(): void
    {
        $this->assertSame('A short reply.', ActivityLogService::excerpt('A short reply.'));
    }

    public function testNoTextAtAllExcerptsToAnEmptyString(): void
    {
        $this->assertSame('', ActivityLogService::excerpt(null));
        $this->assertSame('', ActivityLogService::excerpt(''));
    }

    public function testTextAtTheLimitIsStillKeptWhole(): void
    {
        $atLimit = str_repeat('a', 2000);

        $this->assertSame($atLimit, ActivityLogService::excerpt($atLimit));
    }

    /**
     * The cut is marked rather than left to end mid-sentence, so a reader knows
     * the diff they are looking at is partial.
     */
    public function testLongerTextIsCutAndTheCutIsMarked(): void
    {
        $excerpt = ActivityLogService::excerpt(str_repeat('a', 2001));

        $this->assertSame(str_repeat('a', 2000) . '… [truncated]', $excerpt);
    }

    /**
     * Measured in characters, not bytes: a multibyte cut counted in bytes would
     * both truncate early and split a character down the middle.
     */
    public function testTheLimitCountsCharactersRatherThanBytes(): void
    {
        $bengali = str_repeat('অ', 1500);

        $this->assertSame($bengali, ActivityLogService::excerpt($bengali));
    }

    /**
     * A rolling window starts at a midnight and stays open, so a row written a
     * moment ago is never left out of "Today".
     */
    public function testARollingPeriodStartsAtAMidnightAndHasNoEnd(): void
    {
        $today = gmdate('Y-m-d 00:00:00');

        $this->assertSame([$today, null], ActivityLogService::periodWindow('today'));
        $this->assertSame(
            [gmdate('Y-m-d 00:00:00', strtotime('-6 days', strtotime($today))), null],
            ActivityLogService::periodWindow('7d')
        );
    }

    /** Yesterday is the one window that closes, at today's midnight. */
    public function testYesterdayEndsWhereTodayBegins(): void
    {
        $today = gmdate('Y-m-d 00:00:00');

        $this->assertSame(
            [gmdate('Y-m-d 00:00:00', strtotime('-1 day', strtotime($today))), $today],
            ActivityLogService::periodWindow('yesterday')
        );
    }

    public function testAnUnknownPeriodIsNoWindow(): void
    {
        $this->assertNull(ActivityLogService::periodWindow(''));
        $this->assertNull(ActivityLogService::periodWindow('forever'));
    }

    /**
     * @return array<string, mixed>
     */
    private function onlyRow(): array
    {
        $this->assertCount(1, $GLOBALS['__bc_activity_log']);

        return $GLOBALS['__bc_activity_log'][0];
    }
}
