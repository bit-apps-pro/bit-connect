<?php

namespace BitApps\BitConnect\Enum;

use BitApps\BitConnect\Services\ProFeatures;

// Prevent direct script access
if (!\defined('ABSPATH')) {
    exit;
}

/**
 * What the forum as a whole is allowed to send, and what it sends by default.
 *
 * Its own option rather than a corner of admin_settings, following SeoSettings:
 * this grows a per-type matrix, digest scheduling and sender identity, and
 * wedging that into the settings blob would mean every unrelated save round-
 * trips the lot.
 *
 * Two layers sit above the member's own choices, and they are not the same
 * thing. `inapp`/`email` are *defaults* — the answer for anyone who has never
 * opened the preference screen, and changing one moves everybody who never
 * chose. `userMayOverride` is a *cap*: with it off, the admin's answer is the
 * answer, and the member's row renders locked. Defaults drift; caps do not.
 *
 * Every reader goes through the normalisers below rather than reaching into the
 * array. A setting saved before a notification type existed has no entry for
 * it, and that has to read as "the default" and not as "off".
 */
enum NotificationSettings: string
{
    case OPTION_NAME = 'notification_settings';

    /**
     * How long a read notification is kept before the cleanup job takes it.
     *
     * Long enough to scroll back through a quarter's worth of replies, short
     * enough that a busy forum's table does not grow without limit. Unread rows
     * are never pruned by age — nobody has seen them yet.
     */
    public const RETENTION_DAYS_DEFAULT = 90;

    /**
     * Site-local hour at which a daily or weekly digest goes out.
     */
    public const DIGEST_HOUR_DEFAULT = 8;

    /**
     * How long an unread vote notification stays open to collapse into.
     *
     * Past this a fresh row is written, so "12 people upvoted this" is always
     * about one burst rather than about a month.
     */
    public const COLLAPSE_WINDOW_MINUTES = 1440;

    public const FREQUENCY_INSTANT = 'instant';

    public const FREQUENCY_DAILY = 'daily';

    public const FREQUENCY_WEEKLY = 'weekly';

    public const FREQUENCY_NEVER = 'never';

    /**
     * The master switch. Off means nothing is written and nothing is sent.
     *
     * @param mixed $settings the stored notification_settings option
     */
    public static function isEnabled($settings): bool
    {
        $stored = \is_array($settings) ? $settings : [];

        // Absent reads as on. A forum that upgrades into this feature should
        // start notifying, not sit silent until someone finds the switch.
        return !isset($stored['enabled']) || (bool) $stored['enabled'];
    }

    /**
     * The whole option, normalised — every key present, every type accounted for.
     *
     * @param mixed $settings the stored notification_settings option
     *
     * @return array<string, mixed>
     */
    public static function normalize($settings): array
    {
        $types = [];
        foreach (NotificationTypes::cases() as $type) {
            $types[$type->value] = self::forType($settings, $type);
        }

        return [
            'enabled'          => self::isEnabled($settings),
            'types'            => $types,
            'digestHour'       => self::digestHour($settings),
            'retentionDays'    => self::retentionDays($settings),
            'fromName'         => self::fromName($settings),
            'fromEmail'        => self::fromEmail($settings),
            'defaultFrequency' => self::defaultFrequency($settings),
            // Resolved, not raw: the screen shows the wording that will actually
            // be sent, so an admin who has never touched these sees the real
            // defaults in the fields rather than four empty boxes.
            'mailGreeting'    => self::mailGreeting($settings),
            'mailIntro'       => self::mailIntro($settings),
            'mailDigestIntro' => self::mailDigestIntro($settings),
            'mailFooter'      => self::mailFooter($settings),
        ];
    }

    /**
     * One type's admin row: its two channel defaults and whether members may
     * depart from them.
     *
     * @param mixed $settings the stored notification_settings option
     *
     * @return array{inapp: bool, email: bool, userMayOverride: bool}
     */
    public static function forType($settings, NotificationTypes $type): array
    {
        $stored = \is_array($settings) ? $settings : [];
        $types = \is_array($stored['types'] ?? null) ? $stored['types'] : [];
        $row = \is_array($types[$type->value] ?? null) ? $types[$type->value] : [];

        $defaults = NotificationTypes::channelDefaults($type);

        return [
            'inapp' => isset($row['inapp'])
                ? filter_var($row['inapp'], FILTER_VALIDATE_BOOLEAN)
                : $defaults['inapp'],
            'email' => isset($row['email'])
                ? filter_var($row['email'], FILTER_VALIDATE_BOOLEAN)
                : $defaults['email'],
            // Members may choose unless an admin has taken the choice away.
            'userMayOverride' => !isset($row['userMayOverride'])
                || filter_var($row['userMayOverride'], FILTER_VALIDATE_BOOLEAN),
        ];
    }

    /**
     * The site-local hour a digest goes out, clamped to a real clock hour.
     *
     * @param mixed $settings the stored notification_settings option
     */
    public static function digestHour($settings): int
    {
        if (!self::canCustomiseDelivery()) {
            return self::DIGEST_HOUR_DEFAULT;
        }

        $stored = \is_array($settings) ? $settings : [];
        $hour = isset($stored['digestHour']) ? (int) $stored['digestHour'] : self::DIGEST_HOUR_DEFAULT;

        return max(0, min(23, $hour));
    }

    /**
     * How many days a read notification is kept, floored and capped.
     *
     * @param mixed $settings the stored notification_settings option
     */
    public static function retentionDays($settings): int
    {
        $stored = \is_array($settings) ? $settings : [];
        $days = isset($stored['retentionDays'])
            ? (int) $stored['retentionDays']
            : self::RETENTION_DAYS_DEFAULT;

        // Floored at a week. A retention of zero would delete a notification the
        // moment it was read, which reads as the feature being broken rather
        // than as tidy housekeeping.
        return max(7, min(3650, $days));
    }

    /**
     * The default digest frequency for members who have not chosen one.
     *
     * @param mixed $settings the stored notification_settings option
     */
    public static function defaultFrequency($settings): string
    {
        // Digests are a pro feature, and this is the value the cron reads to
        // decide whether to batch. Gating it here rather than only in the admin
        // screen is what stops a lapsed licence from leaving daily digests
        // going out — the stored choice is kept, it simply stops applying.
        if (!self::canCustomiseDelivery()) {
            return self::FREQUENCY_INSTANT;
        }

        $stored = \is_array($settings) ? $settings : [];
        $frequency = \is_string($stored['defaultFrequency'] ?? null)
            ? $stored['defaultFrequency']
            : self::FREQUENCY_INSTANT;

        return self::isValidFrequency($frequency) ? $frequency : self::FREQUENCY_INSTANT;
    }

    public static function isValidFrequency(string $frequency): bool
    {
        return \in_array($frequency, self::frequencies(), true);
    }

    /**
     * Every email cadence a member may be on.
     *
     * @return array<int, string>
     */
    public static function frequencies(): array
    {
        return [
            self::FREQUENCY_INSTANT,
            self::FREQUENCY_DAILY,
            self::FREQUENCY_WEEKLY,
            self::FREQUENCY_NEVER,
        ];
    }

    /**
     * The placeholders an admin may use in the email templates below.
     *
     * Kept as a list so the admin screen can show exactly what is available
     * rather than documenting it in prose that drifts from the code.
     *
     * @return array<string, string> token => what it becomes
     */
    public static function mailPlaceholders(): array
    {
        return [
            '{name}'  => __('The member\'s display name', 'bit-connect'),
            '{site}'  => __('Your community name', 'bit-connect'),
            '{count}' => __('How many notifications the email covers', 'bit-connect'),
            '{url}'   => __('A link back to the forum', 'bit-connect'),
        ];
    }

    /**
     * The greeting line, before the list of what happened.
     *
     * Templates are plain text with {tokens}. Deliberately not raw HTML: this
     * value is written by an admin and mailed to every member, so anything
     * richer would be an injection surface for the price of a nicer heading.
     *
     * @param mixed $settings the stored notification_settings option
     */
    public static function mailGreeting($settings): string
    {
        return self::template($settings, 'mailGreeting', 'Hello {name},');
    }

    /**
     * The line introducing an instant email.
     *
     * @param mixed $settings the stored notification_settings option
     */
    public static function mailIntro($settings): string
    {
        return self::template($settings, 'mailIntro', 'Here is what happened:');
    }

    /**
     * The line introducing a digest, which covers several things at once.
     *
     * @param mixed $settings the stored notification_settings option
     */
    public static function mailDigestIntro($settings): string
    {
        return self::template($settings, 'mailDigestIntro', 'Here is what you missed:');
    }

    /**
     * The sign-off under the list, above the unsubscribe pointer.
     *
     * @param mixed $settings the stored notification_settings option
     */
    public static function mailFooter($settings): string
    {
        return self::template(
            $settings,
            'mailFooter',
            'Change what you are emailed about in your forum profile:'
        );
    }

    /**
     * Fills {tokens} in a template.
     *
     * @param array<string, int|string> $values token => replacement
     */
    public static function renderTemplate(string $template, array $values): string
    {
        $search = [];
        $replace = [];

        foreach ($values as $token => $value) {
            $search[] = $token;
            $replace[] = (string) $value;
        }

        return str_replace($search, $replace, $template);
    }

    /**
     * Sender name, falling back to the site's own.
     *
     * @param mixed $settings the stored notification_settings option
     */
    public static function fromName($settings): string
    {
        $stored = \is_array($settings) ? $settings : [];
        $name = self::canCustomiseDelivery() && \is_string($stored['fromName'] ?? null)
            ? trim($stored['fromName'])
            : '';

        return $name === '' ? (string) get_bloginfo('name') : $name;
    }

    /**
     * Sender address, falling back to WordPress's default rather than to the
     * admin's own inbox — replies to a notification should not land in a
     * person's mail.
     *
     * @param mixed $settings the stored notification_settings option
     */
    public static function fromEmail($settings): string
    {
        $stored = \is_array($settings) ? $settings : [];
        $email = self::canCustomiseDelivery() && \is_string($stored['fromEmail'] ?? null)
            ? trim($stored['fromEmail'])
            : '';

        if ($email !== '' && is_email($email)) {
            return $email;
        }

        $host = wp_parse_url(network_home_url(), PHP_URL_HOST);
        $host = \is_string($host) ? preg_replace('/^www\./i', '', $host) : '';

        return $host === '' ? (string) get_option('admin_email') : 'wordpress@' . $host;
    }

    /**
     * One stored template line, or the built-in wording when unset or blanked.
     *
     * An admin who empties a field gets the default back rather than an email
     * with a hole in it — a blank greeting reads as a bug in the forum, not as
     * a deliberate choice.
     *
     * @param mixed $settings the stored notification_settings option
     */
    private static function template($settings, string $key, string $default): string
    {
        $stored = \is_array($settings) ? $settings : [];
        $value = self::canCustomiseWording() && \is_string($stored[$key] ?? null)
            ? trim($stored[$key])
            : '';

        // phpcs:ignore WordPress.WP.I18n.NonSingularStringLiteralText -- defaults are English literals defined at the call sites above; translated here at the single read site
        return $value === '' ? __($default, 'bit-connect') : $value;
    }

    /**
     * Whether this site may set its own sender identity and digest schedule.
     *
     * Gated at the normaliser rather than at the screen, because these values
     * are read unsupervised by the cron and by every dispatch. A check that
     * lives only in the admin UI stops nobody: a stale tab, a direct POST or a
     * licence that lapsed after the option was written would all sail past it.
     *
     * Stored values are deliberately kept, not cleared — a site that renews
     * gets its sender and schedule back rather than having to type them again.
     *
     * Do not call before plugins_loaded:12; the add-on registers at 11, after
     * resolving its licence.
     */
    private static function canCustomiseDelivery(): bool
    {
        return ProFeatures::notificationDelivery();
    }

    /**
     * Whether this site may rewrite the four email template lines.
     *
     * Separate from canCustomiseDelivery() only so the two can part company
     * later; they answer the same question today.
     */
    private static function canCustomiseWording(): bool
    {
        return ProFeatures::notificationWording();
    }
}
