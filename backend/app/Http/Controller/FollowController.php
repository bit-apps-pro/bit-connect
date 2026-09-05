<?php

namespace BitApps\BitConnect\Http\Controller;

// Prevent direct script access
if (!\defined('ABSPATH')) {
    exit;
}

use BitApps\BitConnect\Deps\BitApps\WPKit\Http\Response;
use BitApps\BitConnect\Http\Requests\GetFollowsRequest;
use BitApps\BitConnect\Http\Requests\ToggleFollowRequest;
use BitApps\BitConnect\Model\Follow;
use BitApps\BitConnect\Services\FollowService;

/**
 * Following and muting.
 *
 * One endpoint for both directions rather than follow/unfollow pairs: the button
 * is a toggle, and two endpoints would let a double-click leave the member in
 * the state they just left.
 *
 * The state sent back is always re-read from storage rather than inferred from
 * what was asked for. Unfollow does not delete the row — it mutes it — so
 * "following: false" is a fact worth reading rather than assuming.
 */
final class FollowController
{
    public function toggle(ToggleFollowRequest $request)
    {
        $validated = $request->validated();
        $targetType = (string) $validated['target_type'];
        $targetId = (int) $validated['target_id'];
        $userId = get_current_user_id();

        if (!FollowService::isValidTargetType($targetType)) {
            return Response::error([], 422)
                ->message(__('That is not something this forum lets you follow.', 'bit-connect'));
        }

        $wantsToFollow = filter_var($validated['follow'], FILTER_VALIDATE_BOOLEAN);

        $ok = $wantsToFollow
            ? FollowService::follow($userId, $targetType, $targetId)
            : FollowService::unfollow($userId, $targetType, $targetId);

        if (!$ok) {
            return Response::error([], 500)
                ->message(__('That could not be saved. Please try again.', 'bit-connect'));
        }

        return Response::success(FollowService::stateFor($userId, $targetType, $targetId));
    }

    public function mine(GetFollowsRequest $request)
    {
        $validated = $request->validated();
        $targetType = (string) ($validated['target_type'] ?? Follow::TARGET_TOPIC);

        if (!FollowService::isValidTargetType($targetType)) {
            return Response::error([], 422)->message('Unknown follow type: ' . $targetType);
        }

        return Response::success(
            FollowService::mine(
                get_current_user_id(),
                $targetType,
                (int) ($validated['page'] ?? 1),
                (int) ($validated['per_page'] ?? 20)
            )
        );
    }
}
