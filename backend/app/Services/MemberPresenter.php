<?php

namespace BitApps\BitConnect\Services;

// Prevent direct script access
if (!defined('ABSPATH')) {
    exit;
}

use BitApps\BitConnect\Deps\BitApps\WPKit\Hooks\Hooks;
use BitApps\BitConnect\Enum\Capabilities;
use WP_User;

/**
 * One member, shaped the way the Manager screen expects.
 *
 * Lifted out of UserManagementController so it has exactly one definition. The
 * Manager row is rendered from this payload wherever it is produced — the free
 * plugin's own list and reset endpoints, and the add-on's capability endpoint,
 * which returns a member it has just written and must return it in the same
 * shape or the row would change shape depending on which plugin answered.
 *
 * This is a formatter, not a feature: it reads what WordPress already knows
 * about a user and puts it in an array. Nothing here is gated, and nothing here
 * should be — the add-on borrows it so the two plugins cannot drift, not to
 * reach past a check.
 */
final class MemberPresenter
{
    /**
     * @return array{
     *     ID: int,
     *     display_name: string,
     *     user_email: string,
     *     user_login: string,
     *     avatar: string,
     *     roles: array,
     *     capabilities: array<string, bool>,
     *     capOverrides: array<string, bool>,
     *     badges: list<string>
     * }
     */
    public static function format(WP_User $user): array
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
        $badges = Hooks::applyFilter('bit_connect_assigned_badge_ids', [], $user->ID);
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
