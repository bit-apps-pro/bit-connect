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

/**
 * Register the add-on's listeners.
 *
 * @param array<int, string> $features which extension points to implement;
 *                                     defaults to all of them
 */
function bc_test_install_pro_addon(array $features = []): void
{
    $all = [
        'comment_upvotes',
        'notification_delivery',
        'notification_wording',
        'auto_hide',
    ];

    $features = $features === [] ? $all : $features;

    $map = [
        'comment_upvotes'       => 'bit_connect_comment_upvotes_available',
        'notification_delivery' => 'bit_connect_custom_notification_delivery',
        'notification_wording'  => 'bit_connect_custom_notification_wording',
    ];

    foreach ($features as $feature) {
        if (isset($map[$feature])) {
            $GLOBALS['__wp_filters'][$map[$feature]] = true;
        }
    }

    if (\in_array('auto_hide', $features, true)) {
        $GLOBALS['__wp_filters']['bit_connect_should_auto_hide'] = 'bc_test_pro_auto_hide';
    }
}

/**
 * Remove the add-on again.
 */
function bc_test_uninstall_pro_addon(): void
{
    foreach (
        [
            'bit_connect_comment_upvotes_available',
            'bit_connect_custom_notification_delivery',
            'bit_connect_custom_notification_wording',
            'bit_connect_should_auto_hide',
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

