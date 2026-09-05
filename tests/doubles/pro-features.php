<?php

/**
 * Stands in for the Bit Connect Pro add-on.
 *
 * The free plugin no longer asks whether a licence is valid — it asks the
 * ProFeatures extension points whether anything implements a feature, and by
 * itself nothing does. So a test that wants to exercise behaviour the add-on
 * supplies has to do what the add-on does: register against those filters.
 *
 * Seeding $GLOBALS['__wp_filters'] is how the bootstrap's apply_filters() stub
 * takes an answer, and a seeded callable is invoked with the filter's arguments
 * — which is what lets the auto-hide double reproduce the real decision rather
 * than answer a fixed true.
 */

use BitApps\BitConnect\Enum\Capabilities;

/**
 * Register the add-on's listeners.
 *
 * @param array<int, string> $features which extension points to implement;
 *                                     defaults to all of them
 */
function bc_test_install_pro_addon(array $features = []): void
{
    $all = [
        'private_topics',
        'comment_upvotes',
        'notification_delivery',
        'notification_wording',
        'per_user_capabilities',
        'auto_hide',
    ];

    $features = $features === [] ? $all : $features;

    $map = [
        'private_topics'        => 'bit_connect_private_topics_available',
        'comment_upvotes'       => 'bit_connect_comment_upvotes_available',
        'notification_delivery' => 'bit_connect_custom_notification_delivery',
        'notification_wording'  => 'bit_connect_custom_notification_wording',
        'per_user_capabilities' => 'bit_connect_per_user_capabilities_available',
    ];

    foreach ($features as $feature) {
        if (isset($map[$feature])) {
            $GLOBALS['__wp_filters'][$map[$feature]] = true;
        }
    }

    if (\in_array('auto_hide', $features, true)) {
        $GLOBALS['__wp_filters']['bit_connect_should_auto_hide'] = 'bc_test_pro_auto_hide';
    }

    if (\in_array('per_user_capabilities', $features, true)) {
        $GLOBALS['__wp_filters']['bit_connect_apply_user_capabilities'] = 'bc_test_pro_apply_capabilities';
    }
}

/**
 * Remove the add-on again.
 */
function bc_test_uninstall_pro_addon(): void
{
    foreach (
        [
            'bit_connect_private_topics_available',
            'bit_connect_comment_upvotes_available',
            'bit_connect_custom_notification_delivery',
            'bit_connect_custom_notification_wording',
            'bit_connect_per_user_capabilities_available',
            'bit_connect_should_auto_hide',
            'bit_connect_apply_user_capabilities',
        ] as $tag
    ) {
        unset($GLOBALS['__wp_filters'][$tag]);
    }
}

/**
 * The add-on's auto-hide decision.
 *
 * Staff content is exempt whatever the count: otherwise a member who disagreed
 * with a moderator's answer could bury it by reporting it, and on a threshold
 * of one they could do it alone. Staff is a capability question and not a badge
 * one — an admin can hand out a Developer badge, and reading the badge here
 * would let a cosmetic label grant immunity from being reported.
 *
 * @param bool     $hide       the free plugin's answer, always false
 * @param string   $targetType 'post' or 'comment'
 * @param int      $targetId   the reported target
 * @param int      $author     who wrote it
 * @param null|int $pending    open reports, or null to count them here
 */
function bc_test_pro_auto_hide($hide, $targetType, $targetId, $author, $pending = null): bool
{
    if (\BitApps\BitConnect\Services\UserBadgeService::isStaff((int) $author)) {
        return false;
    }

    $pending ??= \BitApps\BitConnect\Model\Report::pendingCount($targetType, (int) $targetId);

    return $pending >= \BitApps\BitConnect\Services\ReportService::autoHideThreshold();
}

/**
 * The add-on writing per-user capability overrides.
 *
 * True grants the capability regardless of role; false revokes it even when the
 * role grants it — the only correct way to override a role capability for one
 * person in WordPress. The escalation guard travels with the write: only a
 * WordPress administrator may hand out the manage capability.
 *
 * @param bool               $applied      the free plugin's answer, always false
 * @param WP_User            $user         the member being changed
 * @param array<string,bool> $capabilities already allowlisted by the Request
 */
function bc_test_pro_apply_capabilities($applied, $user, $capabilities): bool
{
    if (!current_user_can('manage_options')) {
        unset($capabilities[Capabilities::MANAGE->value]);
    }

    foreach ($capabilities as $cap => $granted) {
        $user->add_cap($cap, (bool) $granted);
    }

    return true;
}
