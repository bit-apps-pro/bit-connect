<?php

namespace BitApps\BitConnect\Http\Controller;

// Prevent direct script access
if (!\defined('ABSPATH')) {
    exit;
}

use BitApps\BitConnect\Deps\BitApps\WPKit\Http\Response;
use BitApps\BitConnect\Http\Requests\GetUserStatsRequest;
use BitApps\BitConnect\Services\UserStatsService;

/**
 * Public contribution totals shown on a topic author's card.
 *
 * Kept separate from UserManagementController, which is admin-only: this
 * endpoint is deliberately readable by anyone who can read the portal and must
 * not inherit those capability checks.
 */
final class UserStatsController
{
    private UserStatsService $userStatsService;

    public function __construct()
    {
        $this->userStatsService = new UserStatsService();
    }

    public function stats(GetUserStatsRequest $request)
    {
        $stats = $this->userStatsService->forUser((int) $request->id);

        if ($stats === null) {
            return Response::error(__('User not found.', 'bit-connect'))->httpStatus(404);
        }

        return Response::success($stats);
    }
}
