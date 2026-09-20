<?php

namespace BitApps\BitConnect\Http\Controller;

// Prevent direct script access
if (!defined('ABSPATH')) {
    exit;
}

use BitApps\BitConnect\Deps\BitApps\WPKit\Http\Response;
use BitApps\BitConnect\Http\Requests\GetUsersRequest;
use BitApps\BitConnect\Http\Requests\ResetUserCapabilitiesRequest;
use BitApps\BitConnect\Services\ExtensionPoints;
use BitApps\BitConnect\Services\MemberPresenter;
use WP_User;
use WP_User_Query;

/**
 * REST API controller for per-user forum capability management.
 *
 * GET  /users                       — Paginated list of WP users with forum caps
 * POST /users/{id}/capabilities/reset — Remove all user-level overrides (restore role defaults)
 *
 * There is no endpoint here that *grants* a per-user capability. This plugin's
 * capability model is per role — the matrix on the Manager screen is the whole
 * of it — and it holds no code that writes a user-level capability. Overriding
 * one person's permissions is the Bit Connect Pro add-on's, endpoint and all.
 *
 * Reset stays here, and stays ungated, because it only ever *removes*: a site
 * that never had the add-on has nothing to clear, and a site that has stopped
 * paying for it must still be able to take back permissions it can no longer
 * manage. Removal needs no licence and no pro code to exist.
 */
final class UserManagementController
{
    private const DEFAULT_PER_PAGE = 20;

    private const MAX_PER_PAGE = 100;

    public function getUsers(GetUsersRequest $request)
    {
        $page = max(1, (int) ($request->page ?? 1));
        $perPage = min(self::MAX_PER_PAGE, max(1, (int) ($request->per_page ?? self::DEFAULT_PER_PAGE)));
        $search = sanitize_text_field((string) ($request->search ?? ''));

        $args = [
            'number'  => $perPage,
            'offset'  => ($page - 1) * $perPage,
            'orderby' => 'display_name',
            'order'   => 'ASC',
        ];

        if ($search !== '') {
            $args['search'] = '*' . $search . '*';
            $args['search_columns'] = ['user_login', 'user_email', 'display_name'];
        }

        $query = new WP_User_Query($args);
        $totalUsers = (int) $query->get_total();
        $users = $query->get_results();

        return Response::success(
            [
                'users'       => array_map([$this, 'formatUser'], $users),
                'total'       => $totalUsers,
                'page'        => $page,
                'per_page'    => $perPage,
                'total_pages' => (int) ceil($totalUsers / $perPage),
            ]
        );
    }

    /**
     * Removes all user-level forum capability overrides, restoring role defaults.
     */
    public function resetUserCapabilities(ResetUserCapabilitiesRequest $request)
    {
        $userId = (int) $request->id;
        $user = get_userdata($userId);

        if (!$user instanceof WP_User) {
            return Response::error(__('User not found.', 'bit-connect'))->httpStatus(404);
        }

        foreach (ExtensionPoints::capabilities() as $cap) {
            $user->remove_cap($cap);
        }

        return Response::success($this->formatUser($user));
    }

    // -------------------------------------------------------------------------
    // Internals
    // -------------------------------------------------------------------------

    /**
     * One row of the member list.
     *
     * Delegates so the add-on's capability endpoint, which returns a member it
     * has just written, answers in exactly this shape. See MemberPresenter.
     */
    private function formatUser(WP_User $user): array
    {
        return MemberPresenter::format($user);
    }
}
