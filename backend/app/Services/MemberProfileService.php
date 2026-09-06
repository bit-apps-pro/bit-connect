<?php

namespace BitApps\BitConnect\Services;

// Prevent direct script access
if (!defined('ABSPATH')) {
    exit;
}

use BitApps\BitConnect\Config;

/**
 * The parts of a profile a member writes themselves: a short bio and the links
 * they choose to publish.
 *
 * Stored as user meta rather than in a table of its own — the plugin keeps no
 * user tables, and AvatarService and ProfileSlugService already establish the
 * Config::VAR_PREFIX convention for anything hanging off a member.
 *
 * Both fields end up on a page any visitor can read, so writes are allow-listed
 * and escaped here rather than at the render site: one chokepoint is easier to
 * keep honest than every template that shows a bio.
 */
class MemberProfileService
{
    /**
     * The only link keys a member can publish.
     *
     * A fixed list rather than free key/value pairs: the profile renders one row
     * per known network with its own icon and label, so a key the UI cannot name
     * has nowhere to go.
     */
    public const LINK_KEYS = ['website', 'twitter', 'github', 'linkedin', 'mastodon'];

    /**
     * Longest bio accepted. Mirrored in the client's form rules — keep both in
     * step if it changes.
     */
    public const MAX_BIO_LENGTH = 500;

    /**
     * Protocols a published link may use.
     *
     * The default list esc_url_raw() applies is wider — mailto, ftp, tel and
     * more. A profile link gets clicked by strangers, so it is narrowed to the
     * two that behave like a web page.
     */
    private const LINK_PROTOCOLS = ['http', 'https'];

    private const META_BIO = Config::VAR_PREFIX . 'bio';

    private const META_LINKS = Config::VAR_PREFIX . 'social_links';

    /**
     * A member's bio, or '' when they have not written one.
     *
     * @param int $userId
     *
     * @return string
     */
    public static function bio($userId)
    {
        return (string) get_user_meta((int) $userId, self::META_BIO, true);
    }

    /**
     * Store a bio, clearing it when the member submits an empty one.
     *
     * @param int    $userId
     * @param string $bio
     *
     * @return string what was stored
     */
    public static function setBio($userId, $bio)
    {
        $userId = (int) $userId;
        $clean = self::sanitizeBio($bio);

        if ($clean === '') {
            delete_user_meta($userId, self::META_BIO);

            return '';
        }

        update_user_meta($userId, self::META_BIO, $clean);

        return $clean;
    }

    /**
     * A member's published links, keyed by network.
     *
     * Only keys they have actually filled in are returned, so the profile can
     * render the list without filtering empties back out.
     *
     * @param int $userId
     *
     * @return array<string, string>
     */
    public static function links($userId)
    {
        $stored = get_user_meta((int) $userId, self::META_LINKS, true);

        if (!\is_array($stored)) {
            return [];
        }

        $links = [];

        foreach (self::LINK_KEYS as $key) {
            $url = isset($stored[$key]) ? (string) $stored[$key] : '';

            if ($url !== '') {
                $links[$key] = $url;
            }
        }

        return $links;
    }

    /**
     * Replace a member's links.
     *
     * The whole set is written at once rather than patched key by key: the form
     * submits every field, and an absent key there means "cleared", not
     * "unchanged".
     *
     * @param array<string, string> $links
     * @param int                   $userId
     *
     * @return array<string, string> what was stored
     */
    public static function setLinks($userId, array $links)
    {
        $userId = (int) $userId;
        $clean = self::sanitizeLinks($links);

        if ($clean === []) {
            delete_user_meta($userId, self::META_LINKS);

            return [];
        }

        update_user_meta($userId, self::META_LINKS, $clean);

        return $clean;
    }

    /**
     * Strip a submitted bio down to plain text within the length cap.
     *
     * Tags go but the member's line breaks survive — a bio is prose, not
     * markup, and it renders inside a paragraph.
     *
     * @param mixed $bio
     *
     * @return string
     */
    public static function sanitizeBio($bio)
    {
        if (!\is_string($bio)) {
            return '';
        }

        $clean = trim(sanitize_textarea_field($bio));

        // The request rules reject anything longer, so this only catches a
        // caller that bypassed them; truncating beats storing an unbounded blob.
        return mb_substr($clean, 0, self::MAX_BIO_LENGTH);
    }

    /**
     * Keep the known keys, drop everything else, and escape what survives.
     *
     * @param mixed $links
     *
     * @return array<string, string>
     */
    public static function sanitizeLinks($links)
    {
        if (!\is_array($links)) {
            return [];
        }

        $clean = [];

        foreach (self::LINK_KEYS as $key) {
            if (!isset($links[$key]) || !\is_string($links[$key])) {
                continue;
            }

            $url = esc_url_raw(trim($links[$key]), self::LINK_PROTOCOLS);

            // esc_url_raw returns '' for a protocol it will not allow, which is
            // how a javascript: URL gets dropped rather than stored.
            if ($url !== '') {
                $clean[$key] = $url;
            }
        }

        return $clean;
    }
}
