<?php

namespace BitApps\BitConnect\Http\Controller;

// Prevent direct script access
if (!defined('ABSPATH')) {
    exit;
}

use BitApps\BitConnect\Deps\BitApps\WPKit\Http\Response;
use BitApps\BitConnect\Enum\ActivityActions;
use BitApps\BitConnect\Http\Requests\GetActivityLogRequest;
use BitApps\BitConnect\Services\ActivityLogService;

/**
 * Reads the activity log.
 *
 * Read-only by design: rows are written by the actions they describe and are
 * never edited or removed through the API. A log somebody can tidy up is not a
 * log.
 */
final class ActivityLogController
{
    public function feed(GetActivityLogRequest $request)
    {
        $validated = $request->validated();

        $action = isset($validated['action']) ? (string) $validated['action'] : '';

        // An unknown action slug would otherwise filter to nothing and read as
        // "no activity" rather than "that is not a thing that gets recorded".
        if ($action !== '' && ActivityActions::tryFrom($action) === null) {
            return Response::error('Unknown activity action: ' . $action, 422);
        }

        $targetType = isset($validated['target_type']) ? (string) $validated['target_type'] : '';

        if ($targetType !== '' && !\in_array($targetType, [ActivityLogService::TARGET_POST, ActivityLogService::TARGET_COMMENT], true)) {
            return Response::error('Unknown target type: ' . $targetType, 422);
        }

        return Response::success(
            ActivityLogService::feed(
                [
                    'actor'       => (int) ($validated['actor'] ?? 0),
                    'action'      => $action,
                    'target_type' => $targetType,
                    'target_id'   => max(0, (int) ($validated['target_id'] ?? 0)),
                    'page'        => (int) ($validated['page'] ?? 1),
                    'per_page'    => (int) ($validated['per_page'] ?? 20),
                ]
            )
        );
    }

    /**
     * The action slugs and their labels, so the admin filter does not have to
     * keep its own copy of the enum in step.
     *
     * $request is unread on purpose — the type hint *is* the authorization. The
     * router builds the Request, which runs authorize() before this body is
     * reached, so dropping the parameter would make the endpoint public.
     */
    // phpcs:ignore VariableAnalysis.CodeAnalysis.VariableAnalysis.UnusedVariable -- see above
    public function actions(GetActivityLogRequest $request)
    {
        return Response::success(ActivityActions::options());
    }
}
