<?php

namespace BitApps\BitConnect\Services;

// Prevent direct script access
if (!defined('ABSPATH')) {
    exit;
}

use BitApps\BitConnect\Deps\BitApps\WPKit\Hooks\Hooks;
use BitApps\BitConnect\Deps\BitApps\WPKit\Utils\Capabilities as WpCapabilities;
use BitApps\BitConnect\Enum\Capabilities;

/**
 * A derived capability for "may open the Bit Connect admin menu at all".
 *
 * WordPress takes a single capability string per menu entry — it has no way to
 * express "forum_manage or forum_moderate". Every screen under the menu used to
 * ask for forum_manage, which meant a moderator could not reach the menu, so a
 * moderator-facing screen under it would have been unreachable however it was
 * gated itself.
 *
 * This is not a Capabilities enum case on purpose. Cases in that enum are
 * grantable: they appear in the Manager matrix, they are what applySettings()
 * writes onto roles, and currentUserCapabilities() answers all of them. This one
 * is computed from the two that are, never stored, and never offered as a
 * checkbox — granting it directly would mean nothing, because the filter below
 * recomputes it on every check.
 */
final class AdminAccessService
{
    /**
     * Not prefixed forum_* like the real capabilities, so it cannot be mistaken
     * for one in a settings array or a role dump.
     */
    public const CAP = 'bit_connect_access_admin';

    /**
     * Registers the filter that computes the capability.
     *
     * Must run before `admin_menu`, since that is where the menu asks.
     */
    public static function register(): void
    {
        Hooks::addFilter('user_has_cap', [self::class, 'grant']);
    }

    /**
     * Grants the derived capability to anyone holding either real one.
     *
     * @param array<string, bool> $allcaps every capability WP resolved for the user
     *
     * @return array<string, bool>
     */
    public static function grant($allcaps)
    {
        if (!\is_array($allcaps)) {
            return $allcaps;
        }

        // Assigned unconditionally rather than only when true, so a value stored
        // directly against a role or user is always overwritten by the computed
        // one. Adding it only on the true branch would let this be granted as a
        // back door to the menu without either real capability.
        $allcaps[self::CAP] = !empty($allcaps[Capabilities::MANAGE->value])
            || !empty($allcaps[Capabilities::MODERATE->value]);

        return $allcaps;
    }

    /**
     * Whether the current user may open the admin menu.
     */
    public static function currentUserCan(): bool
    {
        return WpCapabilities::check(self::CAP);
    }
}
