<?php

namespace BitApps\BitConnect\Services;

// Prevent direct script access
if (!defined('ABSPATH')) {
    exit;
}

use BitApps\BitConnect\Deps\BitApps\WPKit\Hooks\Hooks;

/**
 * The extension points through which the Bit Connect Pro add-on adds features
 * this plugin does not have.
 *
 * Every method here answers `false` on its own. That is the whole design, and
 * it is deliberate rather than defensive: this plugin does not implement these
 * features and then decline to run them for want of a licence — it does not
 * implement them at all. The behaviour lives in the add-on, which is a separate
 * plugin distributed separately, and it arrives by registering against these
 * filters. Removing the add-on removes the feature because the code went with
 * it, not because a check started failing.
 *
 * That distinction matters beyond tidiness. A plugin published on WordPress.org
 * may not ship a working feature switched off by a licence test — see
 * docs/pro-separation-guide.md — and these filters are how the split is kept
 * honest on the PHP side, the same way `IS_PRO_ACTIVE` and the `.free`/`.pro`
 * file pair keep it honest in the bundles.
 *
 * Callers ask this class rather than the filter directly, so the extension
 * points are enumerable in one file and a typo in a hook name is a missing
 * method rather than a feature that silently never turns on.
 *
 * Timing: none of these may be called before `plugins_loaded:12`. The add-on
 * registers at 11, after resolving its licence, and a call before that reads as
 * "not installed".
 */
final class ProFeatures
{
    /**
     * Whether reported content is hidden automatically once enough members
     * have reported it.
     *
     * This plugin queues reports and shows them to moderators; it never acts on
     * them by itself. The add-on decides, and is passed everything it needs to:
     * the target, its author (so staff can be exempted — otherwise a member who
     * disagrees with a moderator could bury the answer by reporting it) and the
     * pending count, which the caller has usually already read.
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

    /**
     * Whether replies can be upvoted as well as topics.
     */
    public static function commentUpvotes(): bool
    {
        return (bool) Hooks::applyFilter('bit_connect_comment_upvotes_available', false);
    }

}
