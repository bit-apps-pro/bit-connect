<?php

/**
 * Stands in for the Bit Connect Pro add-on.
 *
 * The free plugin never asks whether a licence is valid. It asks its extension
 * points whether anything implements a feature, and by itself nothing does, so
 * a test that wants to exercise behaviour the add-on supplies has to do what
 * the add-on does: register against those filters.
 *
 * The list is short now, and shrinking it was the point. Comment upvotes and
 * digests left it because they were never really the add-on's — the free plugin
 * implemented both and only refused the last step, which WordPress.org
 * guideline 5 forbids. Private topics and per-user capabilities left it in the
 * other direction: their endpoints moved into the add-on outright, so there is
 * no free-side behaviour left for a filter to switch on.
 *
 * What remains is auto-hide, the shape the rest were meant to have — the free
 * plugin queues reports and a listener decides — plus the three mail filters,
 * which supply a value rather than unlock one and so are uninstalled here but
 * never installed.
 *
 * Seeding $GLOBALS['__wp_filters'] is how the bootstrap's apply_filters() stub
 * takes an answer, and a seeded callable is invoked with the filter's arguments
 * — which is what lets the auto-hide double reproduce the real decision rather
 * than answer a fixed true.
 *
 * The threshold the double compares against is the add-on's, not the free
 * plugin's: the free plugin stores no such number, because a setting for a
 * behaviour it does not perform would be a control with nothing behind it. A
 * test that needs another value seeds $GLOBALS['__bc_test_auto_hide_threshold'].
 */

/**
 * Register the add-on's listeners.
 *
 * @param array<int, string> $features which extension points to implement;
 *                                     defaults to all of them
 */
function bc_test_install_pro_addon(array $features = []): void
{
    $all = ['auto_hide'];

    $features = $features === [] ? $all : $features;

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
            'bit_connect_should_auto_hide',
            'bit_connect_mail_from_name',
            'bit_connect_mail_from_email',
            'bit_connect_mail_template',
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

    $threshold = (int) ($GLOBALS['__bc_test_auto_hide_threshold'] ?? 2);

    return $pending >= max(1, $threshold);
}

