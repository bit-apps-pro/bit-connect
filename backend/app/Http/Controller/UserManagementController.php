<?php

namespace BitApps\BitConnect\Http\Controller;

// Prevent direct script access
if (!\defined('ABSPATH')) {
    exit;
}

use BitApps\BitConnect\Config;
use BitApps\BitConnect\Deps\BitApps\WPKit\Hooks\Hooks;
use BitApps\BitConnect\Deps\BitApps\WPKit\Http\Response;
use BitApps\BitConnect\Enum\Capabilities;
use BitApps\BitConnect\Http\Requests\GetUsersRequest;
use BitApps\BitConnect\Http\Requests\ResetUserCapabilitiesRequest;
use BitApps\BitConnect\Http\Requests\UpdateUserCapabilitiesRequest;
use BitApps\BitConnect\Services\ProFeatures;
use WP_User;
use WP_User_Query;

/**
 * REST API controller for per-user forum capability management.
 *
 * GET  /users                       — Paginated list of WP users with forum caps
 * POST /users/{id}/capabilities     — Set explicit per-user cap overrides
 * POST /users/{id}/capabilities/reset — Remove all user-level overrides (restore role defaults)
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
     * Hands per-user capability overrides to whatever implements them.
     *
     * This plugin's capability model is per role, and that is the whole of it —
     * there is no code here that writes a user-level capability. Overriding one
     * person's permissions is a behaviour the Bit Connect Pro add-on adds
     * through the extension point below, along with the escalation guard that
     * belongs with it.
     *
     * The request is still validated and the capability map still allowlisted
     * before anything is asked: a listener is handed known forum capabilities
     * and nothing else.
     */
    public function updateUserCapabilities(UpdateUserCapabilitiesRequest $request)
    {
        $userId = (int) $request->id;
        $user = get_userdata($userId);

        if (!$user instanceof WP_User) {
            return Response::error(__('User not found.', 'bit-connect'))->httpStatus(404);
        }

        if (!ProFeatures::applyUserCapabilities($user, $request->sanitizedCapabilities())) {
            return Response::error(
                __('Per-user capability overrides are not available on this forum. Set capabilities per role instead.', 'bit-connect')
            )->httpStatus(501);
        }

        // Re-read: the listener wrote through WP_User, and the instance we hold
        // still has the capability set it was loaded with.
        $user = get_userdata($userId);

        return Response::success($this->formatUser($user));
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

        foreach (Capabilities::values() as $cap) {
            $user->remove_cap($cap);
        }

        return Response::success($this->formatUser($user));
    }

    // -------------------------------------------------------------------------
    // Internals
    // -------------------------------------------------------------------------

    private function formatUser(WP_User $user): array
    {
        $effective = [];
        $overrides = [];

        foreach (Capabilities::values() as $cap) {
            $effective[$cap] = (bool) $user->has_cap($cap);

            // $user->caps holds only explicit user-level entries.
            // array_key_exists distinguishes "not set" from "set to false".
            if (\array_key_exists($cap, $user->caps)) {
                $overrides[$cap] = (bool) $user->caps[$cap];
            }
        }

        /**
         * Filter the badge ids stored against this member.
         *
         * Stored ids rather than resolved badges: the row renders the catalog
         * with ticks, so it needs to know what is ticked even for an id no badge
         * answers to any more. The catalog is a pro feature, so the free plugin
         * answers with an empty list and the column stays empty.
         *
         * @param list<string> $ids    assigned badge ids
         * @param int          $userId the member in this row
         */
        $badges = Hooks::applyFilter(Config::withPrefix('assigned_badge_ids'), [], $user->ID);
        $badges = array_values(array_filter((array) $badges, 'is_string'));

        return [
            'ID'           => $user->ID,
            'display_name' => $user->display_name,
            'user_email'   => $user->user_email,
            'user_login'   => $user->user_login,
            'avatar'       => get_avatar_url($user->ID, ['size' => 40]),
            'roles'        => $user->roles,
            'capabilities' => $effective,
            'capOverrides' => $overrides,
            'badges'       => $badges,
        ];
    }
}
