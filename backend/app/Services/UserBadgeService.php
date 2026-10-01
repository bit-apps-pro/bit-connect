<?php

namespace BitApps\BitConnect\Services;

// Prevent direct script access
if (!defined('ABSPATH')) {
    exit;
}

use BitApps\BitConnect\Deps\BitApps\WPKit\Hooks\Hooks;
use BitApps\BitConnect\Enum\BadgeTone;
use BitApps\BitConnect\Enum\Capabilities;

/**
 * The badges shown beside a member's name.
 *
 * One resolver for every surface that names a member — the comment byline, the
 * topic byline and the profile card — so the three cannot disagree about who a
 * person is.
 *
 * This plugin labels nobody on its own. Badges arrive through the
 * `bit_connect_assigned_member_badges` filter, and with nobody answering there
 * are none: a byline is a name and a timestamp. Whatever answers the filter decides
 * what a member wears and in what order.
 *
 * Authority is a separate question and is never read from a badge — see
 * isStaff(), which asks capabilities directly.
 */
final class UserBadgeService
{
    /**
     * Resolved badges keyed by user id, highest priority first.
     *
     * A topic page formats every comment through formatComment(), and each of
     * those asks for a badge. Without this, a hundred-comment thread pays for a
     * hundred get_userdata() round trips to answer the same few authors.
     *
     * @var array<int, list<array{id: null|string, label: string, tone: string}>>
     */
    private static array $resolved = [];

    /**
     * The badge to show beside a name, or null when a member carries none.
     *
     * One badge rather than the whole set: a byline sits inline with the name
     * and the timestamp, and a member wearing three would push the line it
     * annotates onto a second row on every comment in the thread. The profile
     * card, which has the room, calls all() instead.
     *
     * Null rather than a 'Member' badge: an ordinary member's byline shows no
     * tag at all, so the caller renders on presence instead of comparing
     * against a label that means "nothing to show".
     *
     * @return null|array{id: null|string, label: string, tone: string}
     */
    public static function for(int $userId): ?array
    {
        return self::all($userId)[0] ?? null;
    }

    /**
     * Every badge a member carries, highest priority first.
     *
     * @return list<array{id: null|string, label: string, tone: string}>
     */
    public static function all(int $userId): array
    {
        if ($userId <= 0) {
            return [];
        }

        if (\array_key_exists($userId, self::$resolved)) {
            return self::$resolved[$userId];
        }

        return self::$resolved[$userId] = self::resolve($userId);
    }

    /**
     * The label alone, falling back to the given string for members with no
     * badge. Keeps UserProfileService::roleLabel()'s contract, which has always
     * answered a plain string and named ordinary members 'Member'.
     */
    public static function label(int $userId, string $fallback = 'Member'): string
    {
        $badge = self::for($userId);

        return $badge === null ? $fallback : $badge['label'];
    }

    /**
     * Whether a member holds forum authority, ignoring badges entirely.
     *
     * Callers that mean "is this person staff" must ask this and not
     * `for() !== null`. ReportService did, exempting badge-holders from
     * auto-hide, and that reading was correct only while a badge and a
     * capability were the same fact. Now that an admin can hand out a Developer
     * badge, the old reading would have made a cosmetic label quietly grant
     * immunity from being reported.
     */
    public static function isStaff(int $userId): bool
    {
        if ($userId <= 0) {
            return false;
        }

        $user = get_userdata($userId);

        if (!$user) {
            return false;
        }

        return user_can($user, Capabilities::MANAGE->value) || user_can($user, Capabilities::MODERATE->value);
    }

    /**
     * Drops the per-request memo. Only tests, the admin screens that rewrite
     * badges, and long-running CLI processes need this — capabilities do not
     * change midway through a web request.
     */
    public static function flush(): void
    {
        self::$resolved = [];
    }

    /**
     * Works out a member's badges before memoising.
     *
     * @return list<array{id: null|string, label: string, tone: string}>
     */
    private static function resolve(int $userId): array
    {
        $user = get_userdata($userId);

        if (!$user) {
            return [];
        }

        /**
         * Filter the badges this member wears.
         *
         * This plugin hands out none, so with nobody answering this stays empty
         * and the member's name is shown bare.
         *
         * @param list<array{id: null|string, label: string, tone: string}> $badges the member's badges, highest priority first
         * @param int                                                       $userId the member being labelled
         */
        $badges = Hooks::applyFilter('bit_connect_assigned_member_badges', [], $userId);
        $badges = self::sanitizeList($badges);

        $primary = $badges[0] ?? null;

        /**
         * Filter the badge shown beside a member's name.
         *
         * Lets a site rename the badge to whatever it calls its people — Team,
         * Staff, Support. Return null to show no badge.
         *
         * Only the first badge is passed: it is the one a byline prints.
         *
         * @param null|array{id: null|string, label: string, tone: string} $badge  the resolved badge
         * @param int                                                     $userId the member being labelled
         */
        $filtered = self::sanitize(Hooks::applyFilter('bit_connect_member_badge', $primary, $userId));

        if ($primary === null) {
            // A filter may still add a badge to a member who has none.
            return $filtered === null ? [] : [$filtered];
        }

        if ($filtered === null) {
            array_shift($badges);

            return array_values($badges);
        }

        $badges[0] = $filtered;

        return $badges;
    }

    /**
     * Normalises a filtered list of badges, dropping anything malformed.
     *
     * The assigned badges now arrive through a filter rather than a direct call,
     * so they are no longer guaranteed to have come from code this plugin
     * controls. Same reasoning as sanitize() below, applied to each entry.
     *
     * @param mixed $badges
     *
     * @return list<array{id: null|string, label: string, tone: string}>
     */
    private static function sanitizeList($badges): array
    {
        if (!\is_array($badges)) {
            return [];
        }

        $clean = [];

        foreach ($badges as $badge) {
            $sanitized = self::sanitize($badge);

            if ($sanitized !== null) {
                $clean[] = $sanitized;
            }
        }

        return $clean;
    }

    /**
     * Keeps a filtered badge to the documented shape, so a third party returning
     * something else cannot put an unexpected value into every byline payload.
     *
     * @param mixed $badge
     *
     * @return null|array{id: null|string, label: string, tone: string}
     */
    private static function sanitize($badge): ?array
    {
        if (!\is_array($badge)) {
            return null;
        }

        $label = \is_string($badge['label'] ?? null) ? trim($badge['label']) : '';
        $tone = \is_string($badge['tone'] ?? null) ? trim($badge['tone']) : '';
        $id = \is_string($badge['id'] ?? null) ? sanitize_key($badge['id']) : '';

        if ($label === '') {
            return null;
        }

        return [
            'id'    => $id === '' ? null : $id,
            'label' => $label,
            // Rendered as a CSS key, so it is restricted to the tones the
            // portal knows how to style.
            'tone' => BadgeTone::isKnown($tone) ? $tone : BadgeTone::MODERATOR->value,
        ];
    }
}
