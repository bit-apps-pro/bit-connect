<?php

namespace BitApps\BitConnect\Services;

// Prevent direct script access
if (!defined('ABSPATH')) {
    exit;
}

use BitApps\BitConnect\Config;
use BitApps\BitConnect\Enum\Capabilities;
use BitApps\BitConnect\Enum\NotificationSettings;
use BitApps\BitConnect\Enum\NotificationTypes;

/**
 * Answers one question: for this member and this event, which channels fire?
 *
 * Three layers, resolved in this order, and the order is the whole design:
 *
 *   1. The forum's master switch. Off means nothing, for anyone.
 *   2. The admin's per-type row — a default the member may depart from, and a
 *      cap they may not.
 *   3. The member's own choice, stored in user meta, holding only the keys they
 *      have actually touched.
 *
 * A member's stored preferences are deliberately sparse. Writing the full matrix
 * on first save would freeze that day's defaults into their account: an admin who
 * later turns email on for mentions would move everyone except the people who had
 * once opened the screen — the engaged ones. Absent means "whatever the forum
 * currently says", and it keeps meaning that.
 *
 * Preferences live in user meta rather than a table, following AvatarService and
 * ProfileSlugService: the row is per-user, always read by user id, and WordPress
 * deletes it with the account, which is the correct fate for it.
 */
final class NotificationPreferences
{
    public const META_KEY = 'bit_connect_notification_prefs';

    public const CHANNEL_INAPP = 'inapp';

    public const CHANNEL_EMAIL = 'email';

    /**
     * The notification_settings option, held for the life of the request.
     *
     * Read on every recipient of every event — a topic with forty followers asks
     * for it forty times — so it is worth not going back to the options API each
     * time. Null means "not yet read", which is distinct from the empty array a
     * forum that has never saved settings legitimately has.
     *
     * @var null|array<string, mixed>
     */
    private static $settingsCache;

    /**
     * Whether this member gets this event in the app.
     */
    public static function wantsInApp(int $userId, NotificationTypes $type): bool
    {
        // Not negotiable, and checked before anything else so neither an admin
        // nor the member can end up with a removal nobody was told about.
        if (NotificationTypes::isMandatoryInApp($type)) {
            return self::forumAllows($type, $userId);
        }

        return self::resolve($userId, $type, self::CHANNEL_INAPP);
    }

    /**
     * Whether this member gets this event by email.
     *
     * Says nothing about *when*: a member on a daily digest wants the mail, just
     * not yet. frequencyFor() decides that, and the two are separate on purpose —
     * folding them together would mean switching to a digest silently unsubscribed
     * you from types you had asked for.
     */
    public static function wantsEmail(int $userId, NotificationTypes $type): bool
    {
        if (self::frequencyFor($userId) === NotificationSettings::FREQUENCY_NEVER) {
            return false;
        }

        return self::resolve($userId, $type, self::CHANNEL_EMAIL);
    }

    /**
     * How often this member's email should arrive.
     */
    public static function frequencyFor(int $userId): string
    {
        $stored = self::stored($userId);
        $frequency = \is_string($stored['frequency'] ?? null) ? $stored['frequency'] : '';

        if (NotificationSettings::isValidFrequency($frequency)) {
            return $frequency;
        }

        return NotificationSettings::defaultFrequency(self::settings());
    }

    /**
     * The whole preference screen for one member: every type they may see, the
     * effective answer per channel, and whether the row is theirs to change.
     *
     * Built here rather than in the controller so the screen cannot disagree
     * with what dispatch actually does — every value below is the same call the
     * dispatcher makes.
     *
     * @return array{frequency: string, types: array<int, array<string, mixed>>}
     */
    public static function screenFor(int $userId): array
    {
        $settings = self::settings();
        $isModerator = user_can($userId, Capabilities::MODERATE->value);

        $types = [];

        foreach (NotificationTypes::cases() as $type) {
            if (NotificationTypes::isModeratorOnly($type) && !$isModerator) {
                continue;
            }

            $admin = NotificationSettings::forType($settings, $type);
            $mandatory = NotificationTypes::isMandatoryInApp($type);

            $types[] = [
                'type' => $type->value,
                // phpcs:ignore WordPress.WP.I18n.NonSingularStringLiteralText -- labels are English literals defined in #[Label] attributes; translated here at the read site
                'label' => __($type->label(), 'bit-connect'),
                // phpcs:ignore WordPress.WP.I18n.NonSingularStringLiteralText -- see above
                'description' => __($type->description(), 'bit-connect'),
                'inapp'       => self::wantsInApp($userId, $type),
                'email'       => self::resolve($userId, $type, self::CHANNEL_EMAIL),
                // Two separate reasons a switch is not the member's to move, and
                // the screen words them differently — "the forum requires this"
                // is not "your admin turned this off".
                'inappLocked'     => $mandatory || !$admin['userMayOverride'],
                'emailLocked'     => !$admin['userMayOverride'],
                'alwaysDelivered' => $mandatory,
            ];
        }

        return [
            'frequency' => self::frequencyFor($userId),
            'types'     => $types,
        ];
    }

    /**
     * Persist a member's own choices.
     *
     * Only writes keys the member is allowed to set, and only the ones they
     * changed away from nothing — a payload naming a locked type is ignored
     * rather than rejected, because a stale tab should not be able to fail a
     * save of the rows beside it.
     *
     * @param array<string, array<string, bool>> $choices type value => channel => bool
     */
    public static function save(int $userId, array $choices, ?string $frequency = null): void
    {
        $settings = self::settings();
        $isModerator = user_can($userId, Capabilities::MODERATE->value);
        $stored = self::stored($userId);
        $types = \is_array($stored['types'] ?? null) ? $stored['types'] : [];

        foreach ($choices as $typeValue => $channels) {
            $type = NotificationTypes::tryFrom((string) $typeValue);

            if ($type === null || !\is_array($channels)) {
                continue;
            }

            if (NotificationTypes::isModeratorOnly($type) && !$isModerator) {
                continue;
            }

            if (!NotificationSettings::forType($settings, $type)['userMayOverride']) {
                continue;
            }

            $row = \is_array($types[$type->value] ?? null) ? $types[$type->value] : [];

            if (\array_key_exists(self::CHANNEL_INAPP, $channels) && !NotificationTypes::isMandatoryInApp($type)) {
                $row[self::CHANNEL_INAPP] = (bool) $channels[self::CHANNEL_INAPP];
            }

            if (\array_key_exists(self::CHANNEL_EMAIL, $channels)) {
                $row[self::CHANNEL_EMAIL] = (bool) $channels[self::CHANNEL_EMAIL];
            }

            if ($row !== []) {
                $types[$type->value] = $row;
            }
        }

        $stored['types'] = $types;

        if ($frequency !== null && NotificationSettings::isValidFrequency($frequency)) {
            $stored['frequency'] = $frequency;
        }

        update_user_meta($userId, self::META_KEY, $stored);
    }

    /**
     * The stored notification_settings option, read once per request.
     *
     * @return array<string, mixed>
     */
    public static function settings(): array
    {
        if (self::$settingsCache === null) {
            $stored = Config::getOption(NotificationSettings::OPTION_NAME->value, []);
            self::$settingsCache = \is_array($stored) ? $stored : [];
        }

        return self::$settingsCache;
    }

    /**
     * Drops the per-request settings cache.
     *
     * The settings controller must call this after a save: dispatch resolves
     * every recipient through settings(), so a notification sent later in the
     * same request would otherwise be decided by the option as it was before the
     * admin changed it.
     */
    public static function flushSettings(): void
    {
        self::$settingsCache = null;
    }

    /**
     * Whether the forum, ignoring the member, permits this type on any channel.
     *
     * The floor under a mandatory type: even CONTENT_ACTIONED stops when the
     * master switch is off, because that switch means "this forum does not
     * notify", and a moderator-only type stops for anyone who is not one.
     */
    private static function forumAllows(NotificationTypes $type, int $userId): bool
    {
        if (!NotificationSettings::isEnabled(self::settings())) {
            return false;
        }

        return !(NotificationTypes::isModeratorOnly($type) && !user_can($userId, Capabilities::MODERATE->value))



        ;
    }

    /**
     * The three-layer resolution, for one channel.
     */
    private static function resolve(int $userId, NotificationTypes $type, string $channel): bool
    {
        if (!self::forumAllows($type, $userId)) {
            return false;
        }

        $admin = NotificationSettings::forType(self::settings(), $type);

        // A cap, not a default: the admin's answer stands whatever the member
        // has stored, including choices made before the lock went on.
        if (!$admin['userMayOverride']) {
            return (bool) $admin[$channel];
        }

        $stored = self::stored($userId);
        $types = \is_array($stored['types'] ?? null) ? $stored['types'] : [];
        $row = \is_array($types[$type->value] ?? null) ? $types[$type->value] : [];

        if (\array_key_exists($channel, $row)) {
            return (bool) $row[$channel];
        }

        return (bool) $admin[$channel];
    }

    /**
     * One member's raw stored preferences.
     *
     * @return array<string, mixed>
     */
    private static function stored(int $userId): array
    {
        $meta = get_user_meta($userId, self::META_KEY, true);

        return \is_array($meta) ? $meta : [];
    }
}
