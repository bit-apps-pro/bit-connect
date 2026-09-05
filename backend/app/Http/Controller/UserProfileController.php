<?php

namespace BitApps\BitConnect\Http\Controller;

// Prevent direct script access
if (!defined('ABSPATH')) {
    exit;
}

use BitApps\BitConnect\Deps\BitApps\WPKit\Http\Response;
use BitApps\BitConnect\Http\Requests\GetUserContentRequest;
use BitApps\BitConnect\Http\Requests\GetUserPermissionsRequest;
use BitApps\BitConnect\Http\Requests\GetUserProfileRequest;
use BitApps\BitConnect\Http\Requests\GetUserVotesRequest;
use BitApps\BitConnect\Services\UserProfileService;
use BitApps\BitConnect\Services\UserStatsService;

/**
 * Public member profile.
 *
 * GET /users/{id}/profile  — identity + contribution totals (public)
 * GET /users/{id}/topics   — topics they wrote (public)
 * GET /users/{id}/comments — comments they left (public)
 * GET /users/{id}/votes    — topics they upvoted (owner or moderator only)
 *
 * Separate from UserManagementController, which is capability-gated: these must
 * not inherit those checks, and equally must not hand back anything that
 * controller exposes (email, login, roles).
 */
final class UserProfileController
{
    private const HTTP_NOT_FOUND = 404;

    private UserProfileService $profileService;

    private UserStatsService $statsService;

    public function __construct()
    {
        $this->profileService = new UserProfileService();
        $this->statsService = new UserStatsService();
    }

    /**
     * Identity plus totals in one call — the profile header needs both, and
     * two round trips would leave the name and the numbers popping in
     * separately.
     */
    public function profile(GetUserProfileRequest $request)
    {
        // Accepts a slug or an id; everything downstream works in ids.
        $userId = UserProfileService::resolveId($request->id);
        $profile = $this->profileService->profile($userId);

        if ($profile === null) {
            return Response::error(__('User not found.', 'bit-connect'))->httpStatus(self::HTTP_NOT_FOUND);
        }

        return Response::success(
            [
                'user'  => $profile,
                'stats' => $this->statsService->forUser($userId),
            ]
        );
    }

    public function topics(GetUserContentRequest $request)
    {
        if ($this->profileService->profile((int) $request->id) === null) {
            return Response::error(__('User not found.', 'bit-connect'))->httpStatus(self::HTTP_NOT_FOUND);
        }

        return Response::success(
            $this->profileService->topics(
                (int) $request->id,
                (int) ($request->page ?? 1),
                (int) ($request->per_page ?? 10)
            )
        );
    }

    public function comments(GetUserContentRequest $request)
    {
        if ($this->profileService->profile((int) $request->id) === null) {
            return Response::error(__('User not found.', 'bit-connect'))->httpStatus(self::HTTP_NOT_FOUND);
        }

        return Response::success(
            $this->profileService->comments(
                (int) $request->id,
                (int) ($request->page ?? 1),
                (int) ($request->per_page ?? 10)
            )
        );
    }

    public function overview(GetUserContentRequest $request)
    {
        if ($this->profileService->profile((int) $request->id) === null) {
            return Response::error(__('User not found.', 'bit-connect'))->httpStatus(self::HTTP_NOT_FOUND);
        }

        return Response::success(
            $this->profileService->overview(
                (int) $request->id,
                (int) ($request->page ?? 1),
                (int) ($request->per_page ?? 10)
            )
        );
    }

    public function pinned(GetUserContentRequest $request)
    {
        if ($this->profileService->profile((int) $request->id) === null) {
            return Response::error(__('User not found.', 'bit-connect'))->httpStatus(self::HTTP_NOT_FOUND);
        }

        return Response::success(
            $this->profileService->pinnedTopics(
                (int) $request->id,
                (int) ($request->page ?? 1),
                (int) ($request->per_page ?? 10)
            )
        );
    }

    public function permissions(GetUserPermissionsRequest $request)
    {
        $permissions = $this->profileService->permissions((int) $request->id);

        if ($permissions === []) {
            return Response::error(__('User not found.', 'bit-connect'))->httpStatus(self::HTTP_NOT_FOUND);
        }

        return Response::success(['permissions' => $permissions]);
    }

    public function votes(GetUserVotesRequest $request)
    {
        return Response::success(
            $this->profileService->votedTopics(
                (int) $request->id,
                (int) ($request->page ?? 1),
                (int) ($request->per_page ?? 10)
            )
        );
    }
}
