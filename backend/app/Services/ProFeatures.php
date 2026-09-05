<?php

namespace BitApps\BitConnect\Services;

// Prevent direct script access
if (!\defined('ABSPATH')) {
    exit;
}

use BitApps\BitConnect\Config;
use BitApps\BitConnect\Deps\BitApps\WPKit\Hooks\Hooks;
use WP_User;

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
            Config::withPrefix('should_auto_hide'),
            false,
            $targetType,
            $targetId,
            $author,
            $pending
        );
    }

    /**
     * Whether the forum can offer topics visible only to their author and the
     * moderators.
     *
     * Asked after the administrator's own `topicAccess.privateTopic` setting,
     * which is a separate question: the setting says whether the forum wants
     * the feature, this says whether it has it.
     */
    public static function privateTopics(): bool
    {
        return (bool) Hooks::applyFilter(Config::withPrefix('private_topics_available'), false);
    }

    /**
     * Whether replies can be upvoted as well as topics.
     */
    public static function commentUpvotes(): bool
    {
        return (bool) Hooks::applyFilter(Config::withPrefix('comment_upvotes_available'), false);
    }

    /**
     * Whether the forum can set its own sender identity and digest schedule.
     *
     * Read by the settings normaliser rather than only by the screen, because
     * the cron and every dispatch read these values unsupervised — a check that
     * lived in the UI would be bypassed by a stale tab or a direct POST.
     */
    public static function notificationDelivery(): bool
    {
        return (bool) Hooks::applyFilter(Config::withPrefix('custom_notification_delivery'), false);
    }

    /**
     * Whether the four email template lines can be rewritten.
     *
     * Separate from notificationDelivery() only so the two can part company
     * later; they answer the same question today.
     */
    public static function notificationWording(): bool
    {
        return (bool) Hooks::applyFilter(Config::withPrefix('custom_notification_wording'), false);
    }

    /**
     * Whether any of the notification fields above may be written.
     *
     * The settings screen posts one blob, so the write path needs a single
     * answer: with neither feature present the stored values are carried
     * forward untouched rather than overwritten with the neutralised ones the
     * screen was shown.
     */
    public static function notificationCustomisation(): bool
    {
        return self::notificationDelivery() || self::notificationWording();
    }

    /**
     * Whether capabilities can be granted or revoked for one member, on top of
     * what their role gives them.
     *
     * This plugin's capability model is per role: the matrix on the Manager
     * screen is the whole of it. Overriding a single person's permissions is
     * the add-on's.
     */
    public static function perUserCapabilities(): bool
    {
        return (bool) Hooks::applyFilter(Config::withPrefix('per_user_capabilities_available'), false);
    }

    /**
     * Ask the add-on to write per-user capability overrides.
     *
     * Returns false when nothing applied them, which is what a forum without
     * the add-on always gets: this plugin holds no code that writes a user-level
     * capability, so there is nothing here for a listener to switch back on.
     *
     * The listener is handed the already-sanitised map — unknown capabilities
     * are dropped before it is called — and is responsible for refusing to
     * escalate: only a WordPress administrator may grant the manage capability,
     * whatever the caller sent.
     *
     * @param WP_User            $user         the member being changed
     * @param array<string,bool> $capabilities allowlisted forum capabilities
     */
    public static function applyUserCapabilities(WP_User $user, array $capabilities): bool
    {
        return Hooks::applyFilter(
            Config::withPrefix('apply_user_capabilities'),
            false,
            $user,
            $capabilities
        ) === true;
    }
}
