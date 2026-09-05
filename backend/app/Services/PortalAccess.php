<?php

namespace BitApps\BitConnect\Services;

// Prevent direct script access
if (!defined('ABSPATH')) {
    exit;
}

use BitApps\BitConnect\Config;
use BitApps\BitConnect\Enum\GeneralSettings;

/**
 * Who may read the forum at all.
 *
 * `portalAccess` has two values: `everyone`, and `logged_in` for a forum that
 * is only open to members. Until this service existed the setting was read in
 * the SSR layer and handed to the frontend, and nowhere else — so a forum set
 * to members-only still answered `GET /topics` to anonymous callers with every
 * title and body on the site. Closing the front door while the API stayed open
 * is worse than not offering the setting at all, because the administrator
 * believes the forum is private.
 *
 * This is the one place that answers the question, and every portal-facing read
 * Request calls it from `authorize()`. It is deliberately not a capability:
 * capabilities say what a *member* may do, and this is asked before we know
 * whether there is a member at all.
 */
final class PortalAccess
{
    public const EVERYONE = 'everyone';

    public const LOGGED_IN = 'logged_in';

    /**
     * Whether the caller may read forum content.
     *
     * An open forum answers everyone. A members-only forum answers anyone with
     * a WordPress session — not only forum members, matching what the portal
     * itself renders, so the API and the page agree about who gets in.
     */
    public static function canView(): bool
    {
        if (self::mode() === self::LOGGED_IN) {
            return is_user_logged_in();
        }

        return true;
    }

    /**
     * The message a refused reader is given.
     *
     * Says the forum is members-only rather than that the caller lacks a
     * permission: there is nothing they can be granted, they simply need to log
     * in, and the portal turns this into a sign-in prompt.
     */
    public static function deniedMessage(): string
    {
        return __('This community is open to members only. Please log in to continue.', 'bit-connect');
    }

    /**
     * Whether the forum is readable without logging in.
     */
    public static function isPublic(): bool
    {
        return self::mode() === self::EVERYONE;
    }

    /**
     * The configured mode, defaulting to open.
     *
     * An unrecognised stored value reads as open rather than closed: the
     * setting is a deliberate restriction, and a forum should not silently shut
     * itself because an option was written badly.
     */
    private static function mode(): string
    {
        $settings = Config::getOption(GeneralSettings::OPTION_NAME->value, []);

        if (!\is_array($settings)) {
            return self::EVERYONE;
        }

        return ($settings['portalAccess'] ?? self::EVERYONE) === self::LOGGED_IN
            ? self::LOGGED_IN
            : self::EVERYONE;
    }
}
