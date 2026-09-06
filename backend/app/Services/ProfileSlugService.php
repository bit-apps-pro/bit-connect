<?php

namespace BitApps\BitConnect\Services;

// Prevent direct script access
if (!defined('ABSPATH')) {
    exit;
}

use BitApps\BitConnect\Config;
use BitApps\BitConnect\Deps\BitApps\WPKit\Hooks\Hooks;

/**
 * Stable, human-readable slugs for profile URLs (`/user/aiden-carter`).
 *
 * Deliberately NOT `user_nicename`: that field is derived from `user_login`, so
 * routing on it publishes the login. This stores its own slug generated from
 * `display_name` instead. (On accounts where the display name and login are the
 * same string that distinction buys nothing — but it holds for anyone who sets
 * a display name, and it means the URL never re-derives from a credential.)
 *
 * Renames keep working: the previous slug is retained as an alias, so links
 * shared before a rename still resolve instead of 404ing.
 */
class ProfileSlugService
{
    /**
     * Current slug for a member.
     */
    private const META_SLUG = Config::VAR_PREFIX . 'profile_slug';

    /**
     * Slugs this member used previously, kept so old links still resolve.
     */
    private const META_ALIASES = Config::VAR_PREFIX . 'profile_slug_aliases';

    /**
     * Set once a member picks their own slug, after which it stops tracking the
     * display name. See syncUser().
     */
    private const META_CUSTOM = Config::VAR_PREFIX . 'slug_is_custom';

    /**
     * Guards against runaway suffixing if uniqueness can never be satisfied.
     */
    private const MAX_SUFFIX = 50;

    /**
     * Bounds for a member-chosen slug. The floor keeps single letters from
     * being claimed; the ceiling matches what fits in a profile URL without
     * wrapping.
     */
    private const MIN_LENGTH = 3;

    private const MAX_LENGTH = 60;

    /**
     * Slugs a member may not claim.
     *
     * Profile URLs live under /user/, so none of these currently collide with a
     * real route — the list exists so that adding a top-level portal route
     * later cannot be shadowed by whoever registered first.
     */
    private const RESERVED = [
        'admin',
        'api',
        'comments',
        'edit',
        'login',
        'logout',
        'me',
        'new',
        'portal',
        'posts',
        'register',
        'search',
        'settings',
        'signup',
        'tag',
        'tags',
        'topics',
        'user',
        'users',
        'wp-admin',
        'wp-json',
    ];

    /**
     * Keep slugs current as members are created and renamed.
     */
    public static function registerHooks(): void
    {
        Hooks::addAction('user_register', [self::class, 'handleUserChanged']);
        Hooks::addAction('profile_update', [self::class, 'handleUserChanged']);
    }

    /**
     * Action callback for the hooks above.
     *
     * Wraps syncUser(), which returns the slug because callers elsewhere want
     * it. A WordPress action callback must return nothing, so it is wrapped
     * rather than hooked directly.
     *
     * @param int $userId
     */
    public static function handleUserChanged($userId): void
    {
        self::syncUser($userId);
    }

    /**
     * A member's slug, generating and storing one on first use.
     *
     * @param int $userId
     *
     * @return string empty when the user does not exist
     */
    public static function slugFor($userId)
    {
        $userId = (int) $userId;

        if ($userId <= 0) {
            return '';
        }

        $slug = (string) get_user_meta($userId, self::META_SLUG, true);

        if ($slug !== '') {
            return $slug;
        }

        // Lazily backfilled: existing members predate this feature and would
        // otherwise have no slug until they next edited their profile.
        return self::syncUser($userId);
    }

    /**
     * Resolve a slug (current or historic) to a user id.
     *
     * @param string $slug
     *
     * @return int 0 when nothing matches
     */
    public static function resolve($slug)
    {
        $slug = sanitize_title((string) $slug);

        if ($slug === '') {
            return 0;
        }

        $current = get_users(
            [
                'meta_key'   => self::META_SLUG, // phpcs:ignore WordPress.DB.SlowDBQuery.slow_db_query_meta_key -- indexed on meta_key; the alternative is a full user scan.
                'meta_value' => $slug,           // phpcs:ignore WordPress.DB.SlowDBQuery.slow_db_query_meta_value
                'number'     => 1,
                'fields'     => 'ID',
            ]
        );

        if (!empty($current)) {
            return (int) $current[0];
        }

        // Fall back to historic slugs so a link shared before a rename still
        // lands on the right profile.
        $aliased = get_users(
            [
                'meta_key'     => self::META_ALIASES, // phpcs:ignore WordPress.DB.SlowDBQuery.slow_db_query_meta_key
                'meta_value'   => '"' . $slug . '"', // phpcs:ignore WordPress.DB.SlowDBQuery.slow_db_query_meta_value
                'meta_compare' => 'LIKE',
                'number'       => 1,
                'fields'       => 'ID',
            ]
        );

        return empty($aliased) ? 0 : (int) $aliased[0];
    }

    /**
     * (Re)generate a member's slug, retiring the old one into the alias list.
     *
     * @param int $userId
     *
     * @return string the current slug, or '' when the user does not exist
     */
    public static function syncUser($userId)
    {
        $userId = (int) $userId;
        $user = get_userdata($userId);

        if (!$user) {
            return '';
        }

        $previous = (string) get_user_meta($userId, self::META_SLUG, true);

        // A slug the member chose is theirs to keep. This hook also fires on
        // profile_update, so without the guard, editing a display name would
        // silently re-derive the slug from the new name and break every link
        // they had already shared.
        if ($previous !== '' && self::isCustom($userId)) {
            return $previous;
        }

        $desired = self::uniqueSlug(self::baseSlug($user->display_name, $userId), $userId);

        if ($desired === $previous) {
            return $previous;
        }

        update_user_meta($userId, self::META_SLUG, $desired);
        self::retireSlug($userId, $previous);

        return $desired;
    }

    /**
     * Whether this member picked their own slug rather than inheriting one.
     *
     * @param int $userId
     *
     * @return bool
     */
    public static function isCustom($userId)
    {
        return (bool) get_user_meta((int) $userId, self::META_CUSTOM, true);
    }

    /**
     * Normalise submitted text into slug shape.
     *
     * Applied before validating rather than rejecting anything imperfect: a
     * member typing "Aiden Carter" means `aiden-carter`, and refusing the space
     * would be pedantry. What was actually stored is echoed back so the form can
     * show them the result.
     *
     * @param string $slug
     *
     * @return string
     */
    public static function normalizeSlug($slug)
    {
        return sanitize_title((string) $slug);
    }

    /**
     * Check a member-chosen slug before it is stored.
     *
     * @param string $slug
     * @param int    $userId the member claiming it, who does not clash with themselves
     *
     * @return null|string error message, or null when the slug can be used
     */
    public static function validateSlug($slug, $userId)
    {
        $clean = self::normalizeSlug($slug);

        if ($clean === '') {
            return __('Please use letters, numbers or dashes for your profile URL.', 'bit-connect');
        }

        $length = \strlen($clean);

        if ($length < self::MIN_LENGTH || $length > self::MAX_LENGTH) {
            return \sprintf(
                // translators: 1: minimum character count, 2: maximum character count
                __('A profile URL must be between %1$d and %2$d characters.', 'bit-connect'),
                self::MIN_LENGTH,
                self::MAX_LENGTH
            );
        }

        // Same reasoning as baseSlug(): an all-numeric slug is indistinguishable
        // from a user id, and resolveId() treats numerics as ids.
        if (ctype_digit($clean)) {
            return __('A profile URL cannot be only numbers.', 'bit-connect');
        }

        if (\in_array($clean, self::RESERVED, true)) {
            return __('That profile URL is reserved. Please choose another.', 'bit-connect');
        }

        // resolve() rather than a bare meta lookup, so a member cannot claim a
        // slug someone else retired and still has links pointing at.
        $owner = self::resolve($clean);

        // Single exit returning an expression: cs-fixer rewrites a trailing
        // `return null;` into a bare `return;`, which then fails the declared
        // `?string` return under PHPStan.
        return $owner !== 0 && $owner !== (int) $userId
            ? __('That profile URL is already taken.', 'bit-connect')
            : null;
    }

    /**
     * Store a slug the member chose, retiring the old one into the alias list.
     *
     * Validate with validateSlug() first — this assumes the slug is usable.
     *
     * @param string $slug
     * @param int    $userId
     *
     * @return string the slug as stored
     */
    public static function setCustomSlug($userId, $slug)
    {
        $userId = (int) $userId;
        $clean = self::normalizeSlug($slug);
        $previous = (string) get_user_meta($userId, self::META_SLUG, true);

        // The flag is what stops syncUser() re-deriving from the display name.
        // Written before the early return so re-submitting the same slug still
        // pins it; callers only get here when the member touched the field.
        update_user_meta($userId, self::META_CUSTOM, 1);

        if ($clean === $previous) {
            return $previous;
        }

        update_user_meta($userId, self::META_SLUG, $clean);
        self::retireSlug($userId, $previous);

        return $clean;
    }

    /**
     * Keep a superseded slug resolving by adding it to the alias list.
     *
     * @param int    $userId
     * @param string $previous the slug just replaced; '' when there was none
     */
    private static function retireSlug($userId, $previous): void
    {
        if ($previous === '') {
            return;
        }

        $aliases = get_user_meta($userId, self::META_ALIASES, true);
        $aliases = \is_array($aliases) ? $aliases : [];

        if (!\in_array($previous, $aliases, true)) {
            $aliases[] = $previous;
            update_user_meta($userId, self::META_ALIASES, $aliases);
        }
    }

    /**
     * Normalise a display name into a usable slug.
     *
     * Two shapes have to be rewritten rather than accepted: an empty result
     * (a display name of only punctuation or non-Latin script that
     * sanitize_title strips), and an all-numeric one, which would be
     * indistinguishable from a user id if the URL scheme ever accepts both.
     *
     * @param string $displayName
     * @param int    $userId
     *
     * @return string
     */
    private static function baseSlug($displayName, $userId)
    {
        $slug = sanitize_title($displayName);

        if ($slug === '' || ctype_digit($slug)) {
            return 'user-' . $userId;
        }

        return $slug;
    }

    /**
     * Append -2, -3 … until the slug is free.
     *
     * @param string $base
     * @param int    $userId the member being assigned it, who does not count as a clash
     *
     * @return string
     */
    private static function uniqueSlug($base, $userId)
    {
        $candidate = $base;

        for ($suffix = 2; $suffix <= self::MAX_SUFFIX; ++$suffix) {
            $owner = self::resolve($candidate);

            if ($owner === 0 || $owner === $userId) {
                return $candidate;
            }

            $candidate = $base . '-' . $suffix;
        }

        // Every reasonable suffix is taken; fall back to something guaranteed
        // unique rather than looping forever or returning a duplicate.
        return 'user-' . $userId;
    }
}
