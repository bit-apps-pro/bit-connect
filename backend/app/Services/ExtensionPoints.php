<?php

namespace BitApps\BitConnect\Services;

// Prevent direct script access
if (!defined('ABSPATH')) {
    exit;
}

use BitApps\BitConnect\Deps\BitApps\WPKit\Hooks\Hooks;

/**
 * Behaviour this plugin declines to perform, offered to anything that will.
 *
 * Every method here answers `false` on its own, and that is the whole design.
 * These are not features this plugin has and withholds: it does not implement
 * them at all. Each one names a decision the plugin deliberately refuses to
 * make by itself — currently one, whether to hide reported content before a
 * human has looked at it — and hands to a listener if there is one. With no
 * listener the answer is no, and no is a complete, working behaviour rather
 * than a refusal.
 *
 * The filters are public. Any plugin may answer them; the Bit Connect Pro
 * add-on is the one that does, but nothing here knows or asks about that, and
 * a site that wanted its own moderation policy could answer them itself.
 *
 * Callers ask this class rather than the filter directly, so the extension
 * points are enumerable in one file and a typo in a hook name is a missing
 * method rather than a behaviour that silently never turns on.
 *
 * Timing: none of these may be called before `plugins_loaded:12`, because a
 * listener registering at 11 has not been seen yet and the call would read as
 * "nobody answered".
 */
final class ExtensionPoints
{
    /**
     * Whether reported content is hidden automatically once enough members
     * have reported it.
     *
     * This plugin queues reports and shows them to moderators; it never acts on
     * them by itself, and answering no here is that policy rather than a
     * feature switched off. A listener decides otherwise if it wants to, and is
     * passed everything it needs: the target, its author (so staff can be
     * exempted — otherwise a member who disagrees with a moderator could bury
     * the answer by reporting it) and the pending count, which the caller has
     * usually already read.
     *
     * @param string   $targetType 'post' or 'comment'
     * @param int      $targetId   the reported post or comment
     * @param int      $author     who wrote it
     * @param null|int $pending    open reports against it, or null to let the listener count
     */
    public static function autoHideOnReports(string $targetType, int $targetId, int $author, ?int $pending = null): bool
    {
        return (bool) Hooks::applyFilter(
            'bit_connect_should_auto_hide',
            false,
            $targetType,
            $targetId,
            $author,
            $pending
        );
    }

}
