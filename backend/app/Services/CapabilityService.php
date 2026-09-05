<?php

namespace BitApps\BitConnect\Services;

// Prevent direct script access
if (!defined('ABSPATH')) {
    exit;
}

use BitApps\BitConnect\Enum\Capabilities;
use WP_Role;

/**
 * Manages forum capability registration, role assignment, and migration.
 *
 * Design principles:
 * - Never hard-codes role names (subscriber, editor, etc.)
 * - Reads/writes WP role capabilities via get_role() + add_cap()/remove_cap()
 * - Settings stored in wp_options; applied on activation and after admin saves
 * - Compatible with WooCommerce, MemberPress, Ultimate Member, BuddyPress, etc.
 */
final class CapabilityService
{
    private const OPTION_NAME = 'bit_connect_capability_settings';

    private const MIGRATION_OPTION = 'bit_connect_caps_migrated_v2';

    private const SPLIT_MIGRATION_OPTION = 'bit_connect_caps_split_v3';

    private const REVOKE_EDIT_ANY_OPTION = 'bit_connect_caps_revoke_edit_any_v4';

    // -------------------------------------------------------------------------
    // Settings persistence
    // -------------------------------------------------------------------------

    /**
     * Returns the saved capability settings array.
     * Format: ['role_slug' => ['forum_create_post' => true, ...], ...].
     */
    public static function getSettings(): array
    {
        $saved = get_option(self::OPTION_NAME, null);

        if (!\is_array($saved)) {
            return [];
        }

        return $saved;
    }

    /**
     * Persists a role→capability map and immediately applies it to WP roles.
     *
     * @param array<string, array<string, bool>> $settings
     */
    public static function saveSettings(array $settings): void
    {
        $sanitized = self::sanitizeSettings($settings);
        update_option(self::OPTION_NAME, $sanitized);
        self::applySettings($sanitized);
    }

    // -------------------------------------------------------------------------
    // Capability application
    // -------------------------------------------------------------------------

    /**
     * Applies saved capability settings to all WP roles.
     * Only modifies forum_* capabilities — never touches native WP capabilities.
     *
     * Called:
     *   1. On plugin activation (with default settings)
     *   2. After admin saves new settings via CapabilitySettingsController
     */
    public static function applySettings(array $settings): void
    {
        $allRoles = wp_roles()->get_names();

        foreach (array_keys($allRoles) as $roleSlug) {
            $role = get_role($roleSlug);

            if (!$role instanceof WP_Role) {
                continue;
            }

            $roleCaps = $settings[$roleSlug] ?? [];

            foreach (Capabilities::values() as $cap) {
                if (!empty($roleCaps[$cap])) {
                    $role->add_cap($cap, true);
                } else {
                    $role->remove_cap($cap);
                }
            }
        }

        // NOTE: we intentionally do NOT bulk-clear per-user forum_* overrides here.
        // Per-user grants/revokes (UserManagementController::updateUserCapabilities)
        // are a first-class feature stored in user meta, and WP user meta is meant
        // to take precedence over role caps. Wiping them on every role-settings save
        // silently deleted every admin-configured per-user override. Admins who want
        // to drop a user's overrides use the dedicated reset endpoint instead.
    }

    /**
     * Removes all forum_* capabilities from every WP role.
     * Called on plugin deactivation.
     */
    public static function removeAllCapabilities(): void
    {
        $allRoles = wp_roles()->get_names();

        foreach (array_keys($allRoles) as $roleSlug) {
            $role = get_role($roleSlug);

            if (!$role instanceof WP_Role) {
                continue;
            }

            foreach (Capabilities::values() as $cap) {
                $role->remove_cap($cap);
            }
        }
    }

    // -------------------------------------------------------------------------
    // Default settings generation
    // -------------------------------------------------------------------------

    /**
     * Builds a default capability map for all currently registered WP roles.
     *
     * Assignment logic (no role names hard-coded):
     *   - Roles with manage_options → ADMIN_CAPS
     *   - Everything else           → no forum caps
     *
     * Only administrators have access on a fresh install.
     * All other roles must be granted capabilities explicitly via settings.
     */
    public static function buildDefaultSettings(): array
    {
        $settings = [];
        $allRoles = wp_roles()->get_names();

        foreach (array_keys($allRoles) as $roleSlug) {
            $role = get_role($roleSlug);

            if (!$role instanceof WP_Role) {
                continue;
            }

            $settings[$roleSlug] = !empty($role->capabilities['manage_options'])
                ? Capabilities::capMap(Capabilities::adminCaps())
                : [];
        }

        return $settings;
    }

    /**
     * Initialises capability settings on first activation.
     * No-op if settings already exist (safe re-activation).
     */
    public static function initDefaultSettings(): void
    {
        if (get_option(self::OPTION_NAME) !== false) {
            return;
        }

        $defaults = self::buildDefaultSettings();
        update_option(self::OPTION_NAME, $defaults);
        self::applySettings($defaults);
    }

    // -------------------------------------------------------------------------
    // Legacy migration
    // -------------------------------------------------------------------------

    /**
     * One-time migration: maps old bit_connect_* caps to new forum_* caps.
     *
     * Safe to call multiple times — runs only once (guarded by option flag).
     */
    public static function migrateFromLegacyCaps(): void
    {
        if (get_option(self::MIGRATION_OPTION)) {
            return;
        }

        $legacyMap = Capabilities::legacyMap();
        $allRoles = wp_roles()->get_names();
        $derived = [];

        foreach (array_keys($allRoles) as $roleSlug) {
            $role = get_role($roleSlug);

            if (!$role instanceof WP_Role) {
                continue;
            }

            $roleCaps = $role->capabilities;
            $newCaps = [];

            foreach ($legacyMap as $oldCap => $newCapList) {
                if (!empty($roleCaps[$oldCap])) {
                    foreach ($newCapList as $newCap) {
                        $newCaps[$newCap] = true;
                    }
                    // Remove the legacy capability
                    $role->remove_cap($oldCap);
                }
            }

            if (!empty($newCaps)) {
                $derived[$roleSlug] = $newCaps;
            }
        }

        // Merge migrated caps into existing settings (or use as base)
        if (!empty($derived)) {
            $existing = self::getSettings();

            foreach ($derived as $roleSlug => $caps) {
                $existing[$roleSlug] = array_merge($existing[$roleSlug] ?? [], $caps);
            }

            update_option(self::OPTION_NAME, $existing);
            self::applySettings($existing);
        }

        update_option(self::MIGRATION_OPTION, true);
    }

    /**
     * Hands the content-authority capabilities to everyone who held
     * forum_moderate before they were split out of it.
     *
     * Before the split, that one capability meant "edit and delete anyone's
     * content" on top of running the forum. Separating those powers would
     * otherwise take them away from every existing moderator on upgrade, with
     * nothing to explain why. So the upgrade grants what was already held, and
     * an admin narrows it afterwards in Manager if that is what they want.
     *
     * contentAuthorityCaps() is down to forum_delete_any now that editing other
     * people's content has been withdrawn. A site upgrading straight past both
     * changes runs this and revokeEditAny() in turn and ends up with the same
     * result as one that ran them a release apart.
     *
     * Runs once, guarded by its own option. Safe to call on every request:
     * the guard is a single autoloaded option read.
     */
    public static function migrateModerateSplit(): void
    {
        if (get_option(self::SPLIT_MIGRATION_OPTION)) {
            return;
        }

        $settings = self::getSettings();
        $moderateCap = Capabilities::MODERATE->value;
        $granted = [];

        foreach (array_keys(wp_roles()->get_names()) as $roleSlug) {
            $role = get_role($roleSlug);

            if (!$role instanceof WP_Role) {
                continue;
            }

            // Read the live role rather than the saved settings: a site may have
            // been granted the cap by another plugin, or by code, without ever
            // touching the Manager screen that writes those settings.
            $heldModerate = !empty($role->capabilities[$moderateCap])
                || !empty($settings[$roleSlug][$moderateCap]);

            if (!$heldModerate) {
                continue;
            }

            foreach (Capabilities::contentAuthorityCaps() as $cap) {
                $settings[$roleSlug][$cap->value] = true;
            }

            $granted[] = $roleSlug;
        }

        if ($granted !== []) {
            self::saveSettings($settings);
        }

        self::migrateModerateSplitForUsers();

        // Written whether or not anything was granted, so a site with no
        // moderators does not re-scan every role on every admin request.
        update_option(self::SPLIT_MIGRATION_OPTION, true);
    }

    /**
     * Per-user overrides that granted forum_moderate get the same treatment.
     *
     * Role settings are only half the story — UserManagementController writes
     * explicit per-user caps that beat the role, so a member could hold
     * forum_moderate personally and be missed by the role sweep above.
     *
     * Called from migrateModerateSplit(), so it inherits that one-time guard —
     * it must not be wired into a request path on its own.
     *
     * @param array<int, int> $userIds users to inspect; empty means every user
     *                                 holding the old capability
     */
    public static function migrateModerateSplitForUsers(array $userIds = []): int
    {
        $moderateCap = Capabilities::MODERATE->value;

        // Narrowed by usermeta rather than walking every account: WP serialises
        // per-user caps into {prefix}capabilities, so a LIKE on the cap slug
        // reaches only the handful of users who could possibly match. On a
        // forum with thousands of members, get_users() unfiltered would read
        // every one of them to find none.
        $users = $userIds === []
            ? get_users(
                [
                    'fields' => 'ID',
                    // phpcs:disable WordPress.DB.SlowDBQuery.slow_db_query_meta_key, WordPress.DB.SlowDBQuery.slow_db_query_meta_value -- Narrowing on the indexed capabilities meta is what keeps this off a full user-table scan.
                    'meta_key'   => $GLOBALS['wpdb']->get_blog_prefix() . 'capabilities',
                    'meta_value' => $moderateCap,
                    // phpcs:enable WordPress.DB.SlowDBQuery.slow_db_query_meta_key, WordPress.DB.SlowDBQuery.slow_db_query_meta_value
                    'meta_compare' => 'LIKE',
                ]
            )
            : $userIds;
        $updated = 0;

        foreach ($users as $userId) {
            $user = get_userdata((int) $userId);

            if (!$user) {
                continue;
            }

            // $user->caps holds explicit per-user entries only, which is what
            // makes this distinguishable from the role grant handled above.
            if (empty($user->caps[$moderateCap])) {
                continue;
            }

            foreach (Capabilities::contentAuthorityCaps() as $cap) {
                $user->add_cap($cap->value, true);
            }

            ++$updated;
        }

        return $updated;
    }

    /**
     * Takes forum_edit_any back from every role and every user that holds it.
     *
     * The capability was withdrawn: nobody edits content they did not write.
     * Dropping the enum case alone would not have been enough to enforce that.
     * applySettings() only ever walks Capabilities::values(), so a slug no
     * longer listed there is never passed to remove_cap() — the grant would sit
     * on the live role indefinitely, invisible to Manager and still answered by
     * current_user_can() if any code asked for it. This removes it for real.
     *
     * Runs once behind its own option, like migrateModerateSplit().
     *
     * @return int how many roles and users were changed
     */
    public static function revokeEditAny(): int
    {
        if (get_option(self::REVOKE_EDIT_ANY_OPTION)) {
            return 0;
        }

        $cap = Capabilities::WITHDRAWN_EDIT_ANY;
        $revoked = 0;

        foreach (array_keys(wp_roles()->get_names()) as $roleSlug) {
            $role = get_role($roleSlug);

            if (!$role instanceof WP_Role) {
                continue;
            }

            if (!empty($role->capabilities[$cap])) {
                $role->remove_cap($cap);
                ++$revoked;
            }
        }

        // The saved settings keep their own copy of the grant, and it outlives
        // the role change: getRolesWithCapabilities() no longer reads the slug,
        // but saveSettings() would write the stale array straight back if it
        // were left in place.
        $settings = self::getSettings();
        $settingsChanged = false;

        foreach ($settings as $roleSlug => $caps) {
            if (\is_array($caps) && \array_key_exists($cap, $caps)) {
                unset($settings[$roleSlug][$cap]);
                $settingsChanged = true;
            }
        }

        if ($settingsChanged) {
            update_option(self::OPTION_NAME, $settings);
        }

        $revoked += self::revokeEditAnyForUsers();

        update_option(self::REVOKE_EDIT_ANY_OPTION, true);

        return $revoked;
    }

    // -------------------------------------------------------------------------
    // Public API for admin UI
    // -------------------------------------------------------------------------

    /**
     * Returns all WP roles with their current forum capability assignments.
     * Used by the admin settings UI.
     *
     * @return array<int, array{slug: string, name: string, capabilities: array<string, bool>}>
     */
    public static function getRolesWithCapabilities(): array
    {
        $settings = self::getSettings();
        $wpRoles = wp_roles();
        $roleNames = $wpRoles->get_names();
        $result = [];

        foreach ($roleNames as $roleSlug => $roleName) {
            $savedCaps = $settings[$roleSlug] ?? [];
            $caps = [];

            foreach (Capabilities::values() as $cap) {
                $caps[$cap] = !empty($savedCaps[$cap]);
            }

            $result[] = [
                'slug'         => $roleSlug,
                'name'         => translate_user_role($roleName),
                'capabilities' => $caps,
            ];
        }

        return $result;
    }

    /**
     * Updates capabilities for a single role and persists.
     *
     * @param array<string, bool> $caps
     */
    public static function updateRoleCapabilities(string $roleSlug, array $caps): bool
    {
        if (!get_role($roleSlug)) {
            return false;
        }

        $settings = self::getSettings();
        $settings[$roleSlug] = array_intersect_key($caps, array_flip(Capabilities::values()));
        self::saveSettings($settings);

        return true;
    }

    /**
     * Per-user overrides holding forum_edit_any, stripped the same way.
     *
     * A per-user grant beats the role, so revoking on roles alone would leave
     * anyone given the capability individually still holding it. Narrowed by a
     * usermeta LIKE for the same reason migrateModerateSplitForUsers() is: WP
     * serialises per-user caps into one meta row, so this reaches only the
     * accounts that could match instead of reading every member.
     *
     * Called from revokeEditAny(), so it inherits that one-time guard.
     */
    private static function revokeEditAnyForUsers(): int
    {
        $cap = Capabilities::WITHDRAWN_EDIT_ANY;

        $users = get_users(
            [
                'fields' => 'ID',
                // phpcs:disable WordPress.DB.SlowDBQuery.slow_db_query_meta_key, WordPress.DB.SlowDBQuery.slow_db_query_meta_value -- Narrowing on the indexed capabilities meta is what keeps this off a full user-table scan.
                'meta_key'   => $GLOBALS['wpdb']->get_blog_prefix() . 'capabilities',
                'meta_value' => $cap,
                // phpcs:enable WordPress.DB.SlowDBQuery.slow_db_query_meta_key, WordPress.DB.SlowDBQuery.slow_db_query_meta_value
                'meta_compare' => 'LIKE',
            ]
        );

        $revoked = 0;

        foreach ($users as $userId) {
            $user = get_userdata((int) $userId);

            // $user->caps holds explicit per-user entries only — a role grant
            // reaches ->allcaps but not this, and roles are handled above.
            if (!$user || !\array_key_exists($cap, (array) $user->caps)) {
                continue;
            }

            $user->remove_cap($cap);
            ++$revoked;
        }

        return $revoked;
    }

    // -------------------------------------------------------------------------
    // Internals
    // -------------------------------------------------------------------------

    /**
     * Sanitizes settings: strips unknown role slugs and unknown capabilities.
     *
     * @param array<string, array<string, bool>> $settings
     *
     * @return array<string, array<string, bool>>
     */
    private static function sanitizeSettings(array $settings): array
    {
        $validCaps = array_flip(Capabilities::values());
        $validRoles = array_keys(wp_roles()->get_names());
        $clean = [];

        foreach ($validRoles as $roleSlug) {
            if (!isset($settings[$roleSlug])) {
                continue;
            }

            $roleCaps = $settings[$roleSlug];

            if (!\is_array($roleCaps)) {
                continue;
            }

            $clean[$roleSlug] = [];

            foreach ($validCaps as $cap => $_) {
                $clean[$roleSlug][$cap] = !empty($roleCaps[$cap]);
            }
        }

        return $clean;
    }
}
