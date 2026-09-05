<?php

namespace BitApps\BitConnect\Tests\Services;

use BitApps\BitConnect\Enum\ActivityActions;
use BitApps\BitConnect\Services\ActivityLogService;
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
        ActivityLogService::record(ActivityActions::PIN_POST, ActivityLogService::TARGET_POST, 10, self::AUTHOR);

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
     * @return array<string, mixed>
     */
    private function onlyRow(): array
    {
        $this->assertCount(1, $GLOBALS['__bc_activity_log']);

        return $GLOBALS['__bc_activity_log'][0];
    }
}
