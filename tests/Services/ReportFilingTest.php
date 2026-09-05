<?php

namespace BitApps\BitConnect\Tests\Services;

use BitApps\BitConnect\Enum\Capabilities;
use BitApps\BitConnect\Enum\ReportStatus;
use BitApps\BitConnect\Services\ReportService;
use BitApps\BitConnectPro\Utils\PluginCommonConfig;
use InvalidArgumentException;
use PHPUnit\Framework\TestCase;
use WP_Comment;
use WP_Post;
use WP_User;

/**
 * Filing a report, and closing one.
 *
 * Reporting is the one moderation action an ordinary member can take, which
 * makes it the one that has to be hardest to abuse. Two rules carry that: a
 * member may report a given thing once, and staff content is never hidden by
 * the count — without the second, anyone who disagreed with a moderator's
 * answer could bury it by reporting it, and on a threshold of one they could do
 * it alone.
 *
 * Resolution is per target rather than per row: a moderator reviews the content
 * once, and five people reporting the same comment is one decision, not five.
 *
 * @internal
 *
 * @coversNothing
 */
final class ReportFilingTest extends TestCase
{
    private const REPORTER = 3;

    private const AUTHOR = 7;

    private const MODERATOR = 9;

    private const TOPIC = 1491;

    private const COMMENT = 55;

    protected function setUp(): void
    {
        $GLOBALS['__bc_reports'] = [];
        $GLOBALS['__wp_options'] = [];
        $GLOBALS['__wp_transients'] = [];
        $GLOBALS['__wp_users'] = [];
        $GLOBALS['__wp_user_caps'] = [];
        $GLOBALS['__wp_current_user_id'] = self::REPORTER;
        $GLOBALS['__wp_posts'] = [self::TOPIC => $this->topic()];
        $GLOBALS['__wp_comments'] = [self::COMMENT => $this->comment()];
        $GLOBALS['wpdb']->failWrites = false;

        unset($GLOBALS['__bc_report_insert_fails']);

        // Auto-hiding is a pro feature. Licensed here so the threshold logic is
        // what these cases exercise; the gate itself has its own tests below.
        $GLOBALS['__wp_filters'] = [];
        $this->licence(true);

        ReportService::flushPendingCount();
    }

    protected function tearDown(): void
    {
        $GLOBALS['__bc_reports'] = [];
        $GLOBALS['__wp_posts'] = [];
        $GLOBALS['__wp_comments'] = [];
        $GLOBALS['__wp_current_user_id'] = 0;
        $GLOBALS['wpdb']->failWrites = false;

        ReportService::flushPendingCount();
    }

    // -----------------------------------------------------------------------
    // Filing
    // -----------------------------------------------------------------------

    public function testAReportIsFiledAgainstTheContentsAuthor(): void
    {
        $filed = ReportService::file(ReportService::TARGET_POST, self::TOPIC, 'spam');

        $this->assertSame(1, $filed['pending']);

        $row = $GLOBALS['__bc_reports'][0];

        $this->assertSame(self::REPORTER, $row['reporter_id']);
        $this->assertSame(self::AUTHOR, $row['target_author']);
        $this->assertSame('spam', $row['reason']);
        $this->assertSame(ReportStatus::PENDING->value, $row['status']);
    }

    public function testACommentIsReportedAgainstItsOwnAuthor(): void
    {
        ReportService::file(ReportService::TARGET_COMMENT, self::COMMENT, 'spam');

        $this->assertSame(self::AUTHOR, $GLOBALS['__bc_reports'][0]['target_author']);
    }

    public function testALoggedOutVisitorCannotReportAnything(): void
    {
        $GLOBALS['__wp_current_user_id'] = 0;

        $this->expectExceptionMessage('You must be logged in to report anything.');
        ReportService::file(ReportService::TARGET_POST, self::TOPIC, 'spam');
    }

    public function testAReasonTheForumDoesNotRecogniseIsRefused(): void
    {
        $this->expectExceptionMessage('That is not a reason this forum recognises.');
        ReportService::file(ReportService::TARGET_POST, self::TOPIC, 'i-just-dont-like-it');
    }

    /**
     * "Other" says nothing on its own, and a queue entry a moderator cannot act
     * on is worse than no report.
     */
    public function testReportingSomethingAsOtherRequiresSayingWhy(): void
    {
        $this->expectExceptionMessage('Please say what is wrong with it.');
        ReportService::file(ReportService::TARGET_POST, self::TOPIC, 'other');
    }

    public function testOtherIsAcceptedOnceThereIsSomethingToRead(): void
    {
        ReportService::file(ReportService::TARGET_POST, self::TOPIC, 'other', '  Doxxing a member.  ');

        $this->assertSame('Doxxing a member.', $GLOBALS['__bc_reports'][0]['details']);
    }

    public function testTheNamedReasonsNeedNoExplanation(): void
    {
        foreach (['spam', 'abuse', 'harassment', 'off_topic', 'illegal'] as $reason) {
            $GLOBALS['__bc_reports'] = [];
            $GLOBALS['__wp_current_user_id'] = self::REPORTER;

            $this->assertSame(1, ReportService::file(ReportService::TARGET_POST, self::TOPIC, $reason)['pending']);
        }
    }

    /**
     * Empty details are stored as nothing rather than as an empty string, so a
     * queue entry reads as "no note" instead of as a note nobody wrote.
     */
    public function testAReportWithNoNoteStoresNothingRatherThanAnEmptyOne(): void
    {
        ReportService::file(ReportService::TARGET_POST, self::TOPIC, 'spam', '   ');

        $this->assertNull($GLOBALS['__bc_reports'][0]['details']);
    }

    public function testSomethingThatIsNoLongerThereCannotBeReported(): void
    {
        $this->expectExceptionMessage('That content no longer exists.');
        ReportService::file(ReportService::TARGET_POST, 404, 'spam');
    }

    public function testNobodyMayReportTheirOwnContent(): void
    {
        $GLOBALS['__wp_current_user_id'] = self::AUTHOR;

        $this->expectExceptionMessage('You cannot report your own content.');
        ReportService::file(ReportService::TARGET_POST, self::TOPIC, 'spam');
    }

    /**
     * One member, one report. Without this, the count the auto-hide reads is a
     * count of presses rather than of people.
     */
    public function testAMemberMayReportOneThingOnce(): void
    {
        ReportService::file(ReportService::TARGET_POST, self::TOPIC, 'spam');

        $this->expectExceptionMessage('You have already reported this.');
        ReportService::file(ReportService::TARGET_POST, self::TOPIC, 'abuse');
    }

    public function testTwoMembersMayReportTheSameThing(): void
    {
        ReportService::file(ReportService::TARGET_POST, self::TOPIC, 'spam');

        $GLOBALS['__wp_current_user_id'] = 4;

        $this->assertSame(2, ReportService::file(ReportService::TARGET_POST, self::TOPIC, 'abuse')['pending']);
    }

    /**
     * Charged only after the row is stored, so a rejected report costs the
     * reporter nothing.
     */
    public function testARefusedReportDoesNotSpendTheReportersAllowance(): void
    {
        try {
            ReportService::file(ReportService::TARGET_POST, self::TOPIC, 'not-a-reason');
        } catch (InvalidArgumentException $exception) {
            // Expected.
        }

        $this->assertSame(1, ReportService::file(ReportService::TARGET_POST, self::TOPIC, 'spam')['pending']);
    }

    /**
     * Telling a reporter their report was filed while nothing was written is
     * how a duplicate-column bug in this method survived a green test run.
     */
    public function testAReportThatCouldNotBeStoredSaysSo(): void
    {
        $GLOBALS['__bc_report_insert_fails'] = true;

        $this->expectExceptionMessage('Your report could not be saved. Please try again.');
        ReportService::file(ReportService::TARGET_POST, self::TOPIC, 'spam');
    }

    // -----------------------------------------------------------------------
    // The auto-hide
    // -----------------------------------------------------------------------

    public function testContentIsNotHiddenOnOneReport(): void
    {
        $this->assertFalse(ReportService::file(ReportService::TARGET_POST, self::TOPIC, 'spam')['should_hide']);
    }

    public function testContentIsHiddenOnceTheThresholdIsReached(): void
    {
        ReportService::file(ReportService::TARGET_POST, self::TOPIC, 'spam');

        $GLOBALS['__wp_current_user_id'] = 4;

        $this->assertTrue(ReportService::file(ReportService::TARGET_POST, self::TOPIC, 'spam')['should_hide']);
    }

    /**
     * A member who disagreed with a moderator's answer could otherwise bury it
     * by reporting it — and on a threshold of one, alone.
     */
    public function testStaffContentIsNeverHiddenByTheCount(): void
    {
        $GLOBALS['__wp_user_caps'][self::AUTHOR] = [Capabilities::MODERATE->value => true];
        $GLOBALS['__wp_users'][self::AUTHOR] = $this->user(self::AUTHOR);

        ReportService::file(ReportService::TARGET_POST, self::TOPIC, 'spam');
        $GLOBALS['__wp_current_user_id'] = 4;

        $this->assertFalse(ReportService::file(ReportService::TARGET_POST, self::TOPIC, 'spam')['should_hide']);
    }

    /**
     * Staff is a capability question, not a badge one: an admin can hand out a
     * Developer badge, and reading the badge here would let a cosmetic label
     * grant immunity from being reported.
     */
    public function testAnOrdinaryMemberIsNotExemptHoweverTheyAreLabelled(): void
    {
        $GLOBALS['__wp_users'][self::AUTHOR] = $this->user(self::AUTHOR);

        $this->assertTrue(ReportService::shouldAutoHide(ReportService::TARGET_POST, self::TOPIC, self::AUTHOR, 5));
    }

    /**
     * Auto-hiding is what the add-on sells; reporting is not.
     *
     * A free forum still takes the report and still queues it — what it does
     * not do is act on the count before a moderator has looked. Asserted on the
     * report as well as on shouldAutoHide() so a regression that quietly
     * reinstated hiding at the filing site would be caught too.
     */
    public function testAnUnlicensedForumNeverHidesOnTheCount(): void
    {
        $this->licence(false);
        $GLOBALS['__wp_users'][self::AUTHOR] = $this->user(self::AUTHOR);

        $this->assertFalse(
            ReportService::shouldAutoHide(ReportService::TARGET_POST, self::TOPIC, self::AUTHOR, 99)
        );
    }

    public function testAnUnlicensedForumStillTakesTheReport(): void
    {
        $this->licence(false);

        ReportService::file(ReportService::TARGET_POST, self::TOPIC, 'spam');
        $GLOBALS['__wp_current_user_id'] = 4;

        $result = ReportService::file(ReportService::TARGET_POST, self::TOPIC, 'spam');

        $this->assertSame(2, $result['pending']);
        $this->assertFalse($result['should_hide']);
    }

    // -----------------------------------------------------------------------
    // Who is still waiting to hear
    // -----------------------------------------------------------------------

    public function testEveryOpenReportersIdComesBackOnce(): void
    {
        ReportService::file(ReportService::TARGET_POST, self::TOPIC, 'spam');
        $GLOBALS['__wp_current_user_id'] = 4;
        ReportService::file(ReportService::TARGET_POST, self::TOPIC, 'abuse');

        $this->assertSame([self::REPORTER, 4], ReportService::pendingReporterIds(ReportService::TARGET_POST, self::TOPIC));
    }

    /**
     * Read before the decision is recorded, or there is nobody left to tell —
     * which does not fail, it silently notifies no one.
     */
    public function testNobodyIsLeftWaitingOnceTheDecisionIsRecorded(): void
    {
        ReportService::file(ReportService::TARGET_POST, self::TOPIC, 'spam');
        ReportService::resolveTarget(ReportService::TARGET_POST, self::TOPIC, ReportStatus::RESOLVED_KEPT);

        $this->assertSame([], ReportService::pendingReporterIds(ReportService::TARGET_POST, self::TOPIC));
    }

    public function testSomethingNobodyReportedHasNobodyWaiting(): void
    {
        $this->assertSame([], ReportService::pendingReporterIds(ReportService::TARGET_POST, self::TOPIC));
    }

    // -----------------------------------------------------------------------
    // Closing a report
    // -----------------------------------------------------------------------

    /**
     * A moderator reviews the content once; five people reporting the same
     * comment is one decision, not five.
     */
    public function testOneDecisionClosesEveryReportOnTheSameThing(): void
    {
        ReportService::file(ReportService::TARGET_POST, self::TOPIC, 'spam');
        $GLOBALS['__wp_current_user_id'] = 4;
        ReportService::file(ReportService::TARGET_POST, self::TOPIC, 'abuse');

        $GLOBALS['__wp_current_user_id'] = self::MODERATOR;

        $closed = ReportService::resolveTarget(
            ReportService::TARGET_POST,
            self::TOPIC,
            ReportStatus::RESOLVED_REMOVED,
            'Removed as spam.'
        );

        $this->assertSame(2, $closed);

        foreach ($GLOBALS['__bc_reports'] as $row) {
            $this->assertSame(ReportStatus::RESOLVED_REMOVED->value, $row['status']);
            $this->assertSame(self::MODERATOR, $row['resolved_by']);
            $this->assertSame('Removed as spam.', $row['resolution_note']);
        }
    }

    public function testADecisionLeavesReportsOnOtherContentAlone(): void
    {
        ReportService::file(ReportService::TARGET_POST, self::TOPIC, 'spam');
        ReportService::file(ReportService::TARGET_COMMENT, self::COMMENT, 'spam');

        ReportService::resolveTarget(ReportService::TARGET_POST, self::TOPIC, ReportStatus::DISMISSED);

        $this->assertSame(
            [self::REPORTER],
            ReportService::pendingReporterIds(ReportService::TARGET_COMMENT, self::COMMENT)
        );
    }

    public function testAnEmptyNoteIsStoredAsNothing(): void
    {
        ReportService::file(ReportService::TARGET_POST, self::TOPIC, 'spam');
        ReportService::resolveTarget(ReportService::TARGET_POST, self::TOPIC, ReportStatus::RESOLVED_KEPT);

        $this->assertNull($GLOBALS['__bc_reports'][0]['resolution_note']);
    }

    public function testClosingSomethingWithNothingPendingClosesNothing(): void
    {
        $this->assertSame(0, ReportService::resolveTarget(ReportService::TARGET_POST, self::TOPIC, ReportStatus::DISMISSED));
    }

    /**
     * "Resolved as still pending" is not a decision, and accepting it would
     * leave the queue looking emptied while every row stayed open.
     */
    public function testAReportCannotBeResolvedAsStillPending(): void
    {
        ReportService::file(ReportService::TARGET_POST, self::TOPIC, 'spam');

        $this->expectException(InvalidArgumentException::class);
        ReportService::resolveTarget(ReportService::TARGET_POST, self::TOPIC, ReportStatus::PENDING);
    }

    /**
     * Both fail silently enough that the queue simply never emptied, so a write
     * that did not happen has to be reported.
     */
    public function testAWriteThatFailedIsReportedRatherThanCountedAsClosed(): void
    {
        ReportService::file(ReportService::TARGET_POST, self::TOPIC, 'spam');
        $GLOBALS['wpdb']->failWrites = true;

        $this->expectExceptionMessage('The reports could not be updated. Please try again.');
        ReportService::resolveTarget(ReportService::TARGET_POST, self::TOPIC, ReportStatus::RESOLVED_KEPT);
    }

    // -----------------------------------------------------------------------
    // What may be reported
    // -----------------------------------------------------------------------

    public function testOnlyTopicsAndCommentsMayBeReported(): void
    {
        $this->assertTrue(ReportService::isValidTargetType(ReportService::TARGET_POST));
        $this->assertTrue(ReportService::isValidTargetType(ReportService::TARGET_COMMENT));
        $this->assertFalse(ReportService::isValidTargetType('user'));
    }

    public function testTheAuthorOfATargetIsFoundForBothKinds(): void
    {
        $this->assertSame(self::AUTHOR, ReportService::targetAuthor(ReportService::TARGET_POST, self::TOPIC));
        $this->assertSame(self::AUTHOR, ReportService::targetAuthor(ReportService::TARGET_COMMENT, self::COMMENT));
        $this->assertNull(ReportService::targetAuthor(ReportService::TARGET_POST, 404));
        $this->assertNull(ReportService::targetAuthor(ReportService::TARGET_COMMENT, 404));
    }

    // -----------------------------------------------------------------------
    // Helpers
    // -----------------------------------------------------------------------

    private function topic(): WP_Post
    {
        $post = new WP_Post();
        $post->ID = self::TOPIC;
        $post->post_author = self::AUTHOR;
        $post->post_type = 'bit-connect';
        $post->post_title = 'Cannot log in';

        return $post;
    }

    private function comment(): WP_Comment
    {
        $comment = new WP_Comment();
        $comment->comment_ID = self::COMMENT;
        $comment->user_id = self::AUTHOR;
        $comment->comment_post_ID = self::TOPIC;
        $comment->comment_content = 'Same here.';

        return $comment;
    }

    private function user(int $userId): WP_User
    {
        $user = new WP_User();
        $user->ID = $userId;
        $user->display_name = 'Member ' . $userId;

        return $user;
    }

    private function licence(bool $valid): void
    {
        // The add-on registers its listeners only while licensed.
        $valid ? bc_test_install_pro_addon(['auto_hide']) : bc_test_uninstall_pro_addon();

        PluginCommonConfig::setProPluginPrefix('bit_connect_pro_');
        $GLOBALS['__wp_options']['bit_connect_pro_license_data'] = [
            'key'    => 'test-key',
            'status' => $valid ? 'success' : 'expired',
        ];
    }
}
