<?php

namespace BitApps\BitConnect\Http\Controller;

// Prevent direct script access
if (!\defined('ABSPATH')) {
    exit;
}

use BitApps\BitConnect\Deps\BitApps\WPKit\Http\Response;
use BitApps\BitConnect\Enum\ActivityActions;
use BitApps\BitConnect\Enum\NotificationTypes;
use BitApps\BitConnect\Enum\ReportReasons;
use BitApps\BitConnect\Enum\ReportStatus;
use BitApps\BitConnect\Http\Requests\CreateReportRequest;
use BitApps\BitConnect\Http\Requests\GetReportReasonsRequest;
use BitApps\BitConnect\Http\Requests\GetReportsRequest;
use BitApps\BitConnect\Http\Requests\ResolveReportRequest;
use BitApps\BitConnect\Model\Report;
use BitApps\BitConnect\Services\ActivityLogService;
use BitApps\BitConnect\Services\ContentRemovalService;
use BitApps\BitConnect\Services\ContentVisibilityService;
use BitApps\BitConnect\Services\NotificationService;
use BitApps\BitConnect\Services\PermissionService;
use BitApps\BitConnect\Services\ReportService;
use InvalidArgumentException;

/**
 * Filing and reviewing reports.
 *
 * Every rule about whether a report may be filed lives in ReportService; this
 * turns its refusals into responses.
 *
 * Refusals are built as Response::error([])->message($text), never
 * Response::error($text). The first argument to error() is the response *data*,
 * so passing the wording there leaves `message` unset — and both frontends read
 * error.message and nothing else. Written the wrong way round, every sentence
 * below reached the browser and none of them reached the reader: the portal
 * showed "Your report could not be sent. Please try again." in place of "You
 * have already reported this." This is the same shape the framework's own
 * authorization failures use.
 */
final class ReportController
{
    public function create(CreateReportRequest $request)
    {
        $validated = $request->validated();
        $targetType = (string) $validated['target_type'];

        if (!ReportService::isValidTargetType($targetType)) {
            return Response::error([], 422)
                ->message(__('That is not something this forum accepts reports about.', 'bit-connect'));
        }

        try {
            $result = ReportService::file(
                $targetType,
                (int) $validated['target_id'],
                (string) $validated['reason'],
                (string) ($validated['details'] ?? '')
            );
        } catch (InvalidArgumentException $e) {
            // Every refusal from the service is written for the reporter to
            // read, so it is passed through rather than replaced.
            return Response::error([], 422)->message($e->getMessage());
        }

        // The threshold decided this in ReportService; acting on it is the
        // controller's job, so filing a report through any other route cannot
        // hide something by accident.
        $hidden = false;

        if ($result['should_hide']) {
            $hidden = ContentVisibilityService::hide($targetType, (int) $validated['target_id']);

            if ($hidden) {
                // Recorded as the system rather than the reporter: it was the
                // threshold that hid this, not a person exercising a power.
                ActivityLogService::recordAsSystem(
                    ActivityActions::HIDE,
                    $targetType,
                    (int) $validated['target_id'],
                    (int) ReportService::targetAuthor($targetType, (int) $validated['target_id']),
                    ['pending_reports' => $result['pending']]
                );
            }
        }

        // The queue only helps if somebody is told there is something in it.
        // Recipients are resolved by the dispatcher — everyone holding
        // forum_moderate — so this stays correct as capabilities are moved
        // around rather than freezing today's moderators into the call site.
        $snapshot = $this->describeForNotice($targetType, (int) $validated['target_id']);

        NotificationService::dispatch(
            NotificationTypes::REPORT_FILED,
            $targetType === ReportService::TARGET_COMMENT
                ? NotificationService::TARGET_COMMENT
                : NotificationService::TARGET_TOPIC,
            (int) $validated['target_id'],
            array_merge(
                $snapshot,
                [
                    'reason'  => (string) $validated['reason'],
                    'pending' => $result['pending'],
                    // So a moderator opening the bell knows whether they are
                    // looking at something the threshold has already taken down.
                    'hidden' => $hidden,
                ]
            ),
            ((int) $snapshot['topic_id']) > 0 ? (int) $snapshot['topic_id'] : null
        );

        return Response::success(
            [
                'message' => __('Thank you. A moderator will look at this.', 'bit-connect'),
                'pending' => $result['pending'],
                // Said plainly rather than leaving the reporter to infer it from
                // the content vanishing under them.
                'hidden' => $hidden,
            ]
        );
    }

    /**
     * The reasons a member may choose from, labelled.
     *
     * $request is unread on purpose — the type hint is the authorization.
     * See ActivityLogController::actions() for the same pattern.
     */
    // phpcs:ignore VariableAnalysis.CodeAnalysis.VariableAnalysis.UnusedVariable -- see above
    public function reasons(GetReportReasonsRequest $request)
    {
        return Response::success(ReportReasons::options());
    }

    public function queue(GetReportsRequest $request)
    {
        $validated = $request->validated();
        $status = (string) ($validated['status'] ?? ReportStatus::PENDING->value);

        if (ReportStatus::tryFrom($status) === null) {
            return Response::error([], 422)->message('Unknown report status: ' . $status);
        }

        return Response::success(
            ReportService::queue(
                [
                    'status'   => $status,
                    'page'     => (int) ($validated['page'] ?? 1),
                    'per_page' => (int) ($validated['per_page'] ?? 20),
                ]
            )
        );
    }

    public function resolve(ResolveReportRequest $request)
    {
        $validated = $request->validated();
        $targetType = (string) $validated['target_type'];
        $targetId = (int) $validated['target_id'];
        $status = ReportStatus::tryFrom((string) $validated['status']);

        if (!ReportService::isValidTargetType($targetType)) {
            return Response::error([], 422)->message('Unknown target type: ' . $targetType);
        }

        if ($status === null || $status === ReportStatus::PENDING) {
            return Response::error([], 422)->message(__('Choose what to do with the report.', 'bit-connect'));
        }

        $isRemoval = $status === ReportStatus::RESOLVED_REMOVED;

        // Removal is a second power, not part of forum_moderate. A moderator who
        // may work the queue but not delete other people's words keeps the other
        // two endings; this one they cannot reach.
        if ($isRemoval && !PermissionService::canDeleteAny()) {
            return Response::error([], 403)
                ->message(__('You do not have permission to remove other people\'s content.', 'bit-connect'));
        }

        // Read before anything is destroyed: once the content is gone there is
        // no author to attribute the decision to and no words to record. Also
        // the check that stops a removal running against an empty queue — the
        // reports have to still be open for the content to go.
        $author = (int) ReportService::targetAuthor($targetType, $targetId);
        $removalContext = $isRemoval ? ContentRemovalService::describe($targetType, $targetId) : [];

        // Both read here for the same reason as the two above, and each would
        // fail differently if left later. The reporters, because resolveTarget()
        // closes exactly the rows this list comes from — asked afterwards it
        // answers nobody. The snapshot, because a removed comment can no longer
        // say which thread it was in, and "your comment was removed" is the one
        // notification that must still read as a sentence once its subject is
        // gone.
        $reporterIds = ReportService::pendingReporterIds($targetType, $targetId);
        $snapshot = $this->describeForNotice($targetType, $targetId);

        if ($isRemoval && Report::pendingCount($targetType, $targetId) === 0) {
            return Response::error([], 404)->message(__('There is nothing left to review on this.', 'bit-connect'));
        }

        // Destroy first, close second. The other way round, a delete that failed
        // would leave an empty queue and content still standing, with nothing
        // left to click.
        if ($isRemoval && !ContentRemovalService::remove($targetType, $targetId)) {
            return Response::error([], 500)
                ->message(__('That could not be removed, so the reports are still open.', 'bit-connect'));
        }

        try {
            $closed = ReportService::resolveTarget(
                $targetType,
                $targetId,
                $status,
                (string) ($validated['note'] ?? '')
            );
        } catch (InvalidArgumentException $e) {
            return Response::error([], 422)->message($e->getMessage());
        }

        if ($closed === 0) {
            return Response::error([], 404)->message(__('There is nothing left to review on this.', 'bit-connect'));
        }

        // Keep and Dismiss both put it back; Remove takes it away for good. That
        // asymmetry is the whole point of having three endings rather than one
        // — without it, reporting something would be enough to bury it for good.
        $restored = false;

        if (ReportStatus::restoresContent($status)) {
            $restored = ContentVisibilityService::restore($targetType, $targetId);
        }

        if ($isRemoval) {
            // Logged as a deletion in its own right, not folded into the
            // resolution: the Activity screen's whole job is to show what was
            // done to a member's words, and "reports resolved" does not say that
            // theirs are gone.
            ActivityLogService::record(
                $targetType === ReportService::TARGET_COMMENT
                    ? ActivityActions::DELETE_COMMENT
                    : ActivityActions::DELETE_POST,
                $targetType,
                $targetId,
                $author,
                $removalContext,
                (string) ($validated['note'] ?? '')
            );
        }

        ActivityLogService::record(
            $restored ? ActivityActions::RESTORE : ActivityActions::RESOLVE_REPORTS,
            $targetType,
            $targetId,
            $author,
            ['closed' => $closed, 'decision' => $status->value],
            (string) ($validated['note'] ?? '')
        );

        $this->notifyDecision(
            $targetType,
            $targetId,
            $author,
            $status,
            $isRemoval,
            $reporterIds,
            $snapshot,
            (string) ($validated['note'] ?? '')
        );

        return Response::success(
            [
                'closed'   => $closed,
                'status'   => $status->value,
                'restored' => $restored,
                // So the queue can say "removed" rather than leaving a moderator
                // to guess whether the words are gone or merely still hidden.
                'removed' => $isRemoval,
            ]
        );
    }

    /**
     * What the reported item was, read while it still exists.
     *
     * @return array{topic_id: int, topic_title: string, excerpt: string, url: string}
     */
    private function describeForNotice(string $targetType, int $targetId): array
    {
        if ($targetType === ReportService::TARGET_COMMENT) {
            $comment = get_comment($targetId);

            if (!$comment) {
                return ['topic_id' => 0, 'topic_title' => '', 'excerpt' => '', 'url' => ''];
            }

            $topic = get_post((int) $comment->comment_post_ID);

            return [
                'topic_id'    => (int) $comment->comment_post_ID,
                'topic_title' => $topic ? (string) $topic->post_title : '',
                'excerpt'     => ActivityLogService::excerpt($comment->comment_content),
                'url'         => (string) get_comment_link($comment),
            ];
        }

        $post = get_post($targetId);

        if (!$post) {
            return ['topic_id' => 0, 'topic_title' => '', 'excerpt' => '', 'url' => ''];
        }

        return [
            'topic_id'    => $targetId,
            'topic_title' => (string) $post->post_title,
            'excerpt'     => ActivityLogService::excerpt($post->post_content),
            'url'         => (string) get_permalink($post),
        ];
    }

    /**
     * Tells the people a decision is an answer to.
     *
     * Two audiences with two different stakes, so two dispatches rather than one
     * with a merged recipient list:
     *
     *   - The reporters asked a question and are owed the answer, whichever way
     *     it went. Dismissed counts — "we looked and it was fine" is a result,
     *     and a report that vanishes silently teaches people not to bother.
     *   - The author is told only when their content actually went. Being
     *     reported and cleared is not something they need to know about, and
     *     telling them would turn every rejected report into an accusation
     *     delivered on the reporter's behalf.
     *
     * The moderator who decided is excluded from both automatically — the
     * dispatcher drops the actor, so a moderator who had also reported the item
     * does not get told their own answer.
     *
     * @param array<int, int>      $reporterIds
     * @param array<string, mixed> $snapshot
     */
    private function notifyDecision(
        string $targetType,
        int $targetId,
        int $author,
        ReportStatus $status,
        bool $isRemoval,
        array $reporterIds,
        array $snapshot,
        string $note
    ): void {
        $notifyTarget = $targetType === ReportService::TARGET_COMMENT
            ? NotificationService::TARGET_COMMENT
            : NotificationService::TARGET_TOPIC;

        $topicId = (int) ($snapshot['topic_id'] ?? 0);

        $context = array_merge(
            $snapshot,
            [
                'decision' => $status->value,
                // phpcs:ignore WordPress.WP.I18n.NonSingularStringLiteralText -- labels are English literals defined in #[Label] attributes; translated here at the read site
                'decision_label' => __($status->label(), 'bit-connect'),
                'note'           => $note,
            ]
        );

        if ($reporterIds !== []) {
            NotificationService::dispatch(
                NotificationTypes::REPORT_RESOLVED,
                $notifyTarget,
                $targetId,
                $context,
                $topicId > 0 ? $topicId : null,
                $reporterIds
            );
        }

        if (!$isRemoval || $author <= 0) {
            return;
        }

        NotificationService::dispatch(
            NotificationTypes::CONTENT_ACTIONED,
            $notifyTarget,
            $targetId,
            $context,
            $topicId > 0 ? $topicId : null,
            [$author]
        );
    }
}
