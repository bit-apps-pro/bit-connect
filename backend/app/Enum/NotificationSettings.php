<?php

namespace BitApps\BitConnect\Enum;

use BitApps\BitConnect\Deps\BitApps\WPKit\Hooks\Hooks;

// Prevent direct script access
if (!defined('ABSPATH')) {
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
     * Digests are this plugin's own feature: NotificationPreferences::
     * frequencyFor() reads a member's own choice, NotificationController saves
     * it, and NotificationDigest batches and sends on the hourly cron. This
     * value is only the default for members who have not chosen, and the
     * admin's saved choice always applies.
     *
     * @param mixed $settings the stored notification_settings option
     */
    public static function defaultFrequency($settings): string
    {
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
        // translators: {name} is replaced with the member's display name.
        return self::template($settings, 'mailGreeting', __('Hello {name},', 'bit-connect'));
    }

    /**
     * The line introducing an instant email.
     *
     * @param mixed $settings the stored notification_settings option
     */
    public static function mailIntro($settings): string
    {
        return self::template($settings, 'mailIntro', __('Here is what happened:', 'bit-connect'));
    }

    /**
     * The line introducing a digest, which covers several things at once.
     *
     * @param mixed $settings the stored notification_settings option
     */
    public static function mailDigestIntro($settings): string
    {
        return self::template($settings, 'mailDigestIntro', __('Here is what you missed:', 'bit-connect'));
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
            __('Change what you are emailed about in your forum profile:', 'bit-connect')
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
     * Sender name: the site's own, unless something supplies another.
     *
     * This plugin sends forum email as the site. It holds no setting for a
     * sender of its own and no code that would read one — choosing a sender
     * identity is the Bit Connect Pro add-on's feature, and it arrives by
     * filtering this value rather than by unlocking a field stored here.
     *
     * @param mixed $settings the stored notification_settings option
     */
    public static function fromName($settings): string
    {
        /**
         * Filter the name forum email is sent as.
         *
         * @param string $name     the site title
         * @param mixed  $settings the stored notification_settings option
         */
        $name = Hooks::applyFilter('bit_connect_mail_from_name', (string) get_bloginfo('name'), $settings);
        $name = \is_string($name) ? trim($name) : '';

        return $name === '' ? (string) get_bloginfo('name') : $name;
    }

    /**
     * Sender address: WordPress's default, unless something supplies another.
     *
     * The default is WordPress's own rather than the admin's inbox — replies to
     * a notification should not land in a person's mail. As with fromName, a
     * chosen address is the add-on's and reaches this through the filter; an
     * address that is not a valid one is ignored rather than sent.
     *
     * @param mixed $settings the stored notification_settings option
     */
    public static function fromEmail($settings): string
    {
        $host = wp_parse_url(network_home_url(), PHP_URL_HOST);
        $host = \is_string($host) ? preg_replace('/^www\./i', '', $host) : '';
        $default = $host === '' ? (string) get_option('admin_email') : 'wordpress@' . $host;

        /**
         * Filter the address forum email is sent from.
         *
         * @param string $email    WordPress's own default sender
         * @param mixed  $settings the stored notification_settings option
         */
        $email = Hooks::applyFilter('bit_connect_mail_from_email', $default, $settings);
        $email = \is_string($email) ? trim($email) : '';

        return $email !== '' && is_email($email) ? $email : $default;
    }

    /**
     * One stored template line, or the built-in wording when unset or blanked.
     *
     * An admin who empties a field gets the default back rather than an email
     * with a hole in it — a blank greeting reads as a bug in the forum, not as
     * a deliberate choice.
     *
     * $default arrives already translated. It cannot be translated here: `wp
     * i18n make-pot` reads source, not runtime, so __($default) would put
     * nothing in the catalog and every locale would get the English back. Each
     * caller wraps its own literal instead, where the extractor can see it.
     *
     * @param mixed $settings the stored notification_settings option
     */
    private static function template($settings, string $key, string $default): string
    {
        /**
         * Filter one line of the wording around a notification email.
         *
         * This plugin's own wording is the default and is what a forum sends;
         * rewriting it is the Bit Connect Pro add-on's feature, and arrives
         * here rather than by unlocking a field stored on this side. A filter
         * that answers with nothing is ignored, for the same reason a blanked
         * field always was: an email with a hole in it reads as a bug.
         *
         * @param string $line     this plugin's wording, already translated
         * @param string $key      one of mailGreeting|mailIntro|mailDigestIntro|mailFooter
         * @param mixed  $settings the stored notification_settings option
         */
        $value = Hooks::applyFilter('bit_connect_mail_template', $default, $key, $settings);
        $value = \is_string($value) ? trim($value) : '';

        return $value === '' ? $default : $value;
    }
}
