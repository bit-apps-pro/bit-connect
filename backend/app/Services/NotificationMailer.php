<?php

namespace BitApps\BitConnect\Services;

// Prevent direct script access
if (!\defined('ABSPATH')) {
    exit;
}

use BitApps\BitConnect\Config;
use BitApps\BitConnect\Deps\BitApps\WPDatabase\Connection;
use BitApps\BitConnect\Deps\BitApps\WPKit\Hooks\Hooks;
use BitApps\BitConnect\Enum\NotificationSettings;
use BitApps\BitConnect\Enum\NotificationTypes;
use BitApps\BitConnect\Model\Notification;

/**
 * Turns notifications into mail.
 *
 * Plain text, like the two emails this plugin already sends (AuthService and
 * EmailChangeService). Not an oversight: a notification is one or two sentences
 * and a link, HTML mail brings a whole class of client-rendering problems with
 * it, and plain text lands in more inboxes. If a themed template is wanted later
 * it belongs behind self::body(), which is the only method that decides wording.
 *
 * **Instant mail never sends inside the request that caused it.** SMTP can take
 * seconds, and a member posting a comment would sit and wait for five other
 * people's mail to go out before their own reply appeared. So dispatch only
 * records an id, and the sending happens on `shutdown`, after the response has
 * gone. `shutdown` rather than wp_schedule_single_event(): WP-Cron only runs
 * when some later request happens to trigger it, and on a quiet forum "later"
 * can be hours — which is not what a member choosing Instant asked for.
 *
 * `emailed_at` is the ledger. Null means the row still owes an email; it is
 * stamped the moment one is sent or the moment it is decided that none is owed.
 * Nothing else prevents a double send, so every path out of here stamps.
 */
final class NotificationMailer
{
    /**
     * Notification ids to mail when this request finishes.
     *
     * Ids rather than rows: between dispatch and shutdown the member may have
     * read the notification in another tab, and re-reading at send time is what
     * lets that be noticed.
     *
     * @var array<int, array<int, int>> user id => notification ids
     */
    private static $queue = [];

    /**
     * Registers the instant-mail path.
     *
     * Called from HookProvider. Cheap when nothing is dispatched — the shutdown
     * hook is only added once something is actually queued.
     */
    public static function register(): void
    {
        Hooks::addAction('bit_connect_notification_dispatched', [self::class, 'queue'], 10, 4);
    }

    /**
     * Notes that a delivered notification owes an immediate email.
     *
     * Digest members are skipped here and left for NotificationDigest, which is
     * why frequency is read now rather than at send time: the row's `emailed_at`
     * stays null either way, and this is the only thing that decides which of
     * the two paths claims it.
     */
    public static function queue(int $userId, string $type, bool $owesEmail, int $notificationId = 0): void
    {
        if (!$owesEmail || $notificationId <= 0 || $userId <= 0) {
            return;
        }

        if (NotificationPreferences::frequencyFor($userId) !== NotificationSettings::FREQUENCY_INSTANT) {
            return;
        }

        if (self::$queue === []) {
            // Added on first use so a request that notifies nobody does not pay
            // for a shutdown callback.
            Hooks::addAction('shutdown', [self::class, 'flush'], 100);
        }

        self::$queue[$userId][] = $notificationId;
    }

    /**
     * Sends everything this request queued. Runs after the response is finished.
     */
    public static function flush(): void
    {
        $queued = self::$queue;
        // Cleared first: a fatal inside a send must not leave the same ids
        // queued for a second attempt in the same process.
        self::$queue = [];

        foreach ($queued as $userId => $ids) {
            $rows = Notification::owingEmail((int) $userId, $ids);

            if ($rows === []) {
                continue;
            }

            self::deliver((int) $userId, $rows, false);
        }
    }

    /**
     * Mails one member a batch and stamps every row in it.
     *
     * Rows are stamped whether or not wp_mail() succeeded. A forum with no
     * working mail configuration would otherwise re-send the same backlog every
     * hour forever, which turns a misconfiguration into an outbound flood the
     * moment it is fixed.
     *
     * @param array<int, object> $rows
     *
     * @return bool whether the mail was accepted for delivery
     */
    public static function deliver(int $userId, array $rows, bool $isDigest): bool
    {
        $user = get_userdata($userId);

        if (!$user || !is_email($user->user_email)) {
            // Nowhere to send it. Stamped so the digest stops carrying it.
            self::stamp($rows);

            return false;
        }

        $settings = NotificationPreferences::settings();

        $applyFrom = static fn (): string => NotificationSettings::fromEmail($settings);
        $applyName = static fn (): string => NotificationSettings::fromName($settings);

        // Added and removed around this one send. Left in place they would
        // rewrite the sender on every other email the site produces —
        // password resets included.
        Hooks::addFilter('wp_mail_from', $applyFrom, 99);
        Hooks::addFilter('wp_mail_from_name', $applyName, 99);

        $sent = wp_mail(
            $user->user_email,
            self::subject($rows, $isDigest),
            self::body($user->display_name, $rows, $isDigest)
        );

        remove_filter('wp_mail_from', $applyFrom, 99);
        remove_filter('wp_mail_from_name', $applyName, 99);

        self::stamp($rows);

        return (bool) $sent;
    }

    /**
     * Sends one member a message proving the forum can reach them.
     *
     * Goes through the same sender identity and the same wp_mail() call every
     * real notification uses, which is the point: a test that took its own path
     * would pass on a site where notifications do not arrive. Writes no row and
     * stamps nothing — there is no notification here, only a delivery check.
     *
     * @return bool whether the mail was accepted for delivery
     */
    public static function sendTest(int $userId): bool
    {
        $user = get_userdata($userId);

        if (!$user || !is_email($user->user_email)) {
            return false;
        }

        $settings = NotificationPreferences::settings();
        $site = trim(NotificationSettings::fromName($settings));

        $applyFrom = static fn (): string => NotificationSettings::fromEmail($settings);
        $applyName = static fn (): string => NotificationSettings::fromName($settings);

        Hooks::addFilter('wp_mail_from', $applyFrom, 99);
        Hooks::addFilter('wp_mail_from_name', $applyName, 99);

        $sent = wp_mail(
            $user->user_email,
            $site === ''
                ? __('Test notification', 'bit-connect')
                // translators: %s: site name
                : \sprintf(__('Test notification from %s', 'bit-connect'), $site),
            // translators: %s: member's display name
            \sprintf(__('Hello %s,', 'bit-connect'), $user->display_name)
                . "\n\n"
                . __(
                    'This is a test message from your forum\'s notification settings. If you are reading it, email notifications are working.',
                    'bit-connect'
                )
                . "\n\n"
                . AuthService::getForumPageUrl()
        );

        remove_filter('wp_mail_from', $applyFrom, 99);
        remove_filter('wp_mail_from_name', $applyName, 99);

        return (bool) $sent;
    }

    /**
     * One line describing what happened, for the body of the mail.
     *
     * Reads the stored context rather than looking the target up: by the time a
     * digest goes out the comment may be gone, and "your post was removed" is
     * precisely the notification that must still say something.
     *
     * @param mixed $row
     */
    public static function line($row): string
    {
        $type = NotificationTypes::tryFrom((string) $row->type);
        $context = \is_string($row->context) ? json_decode($row->context, true) : [];
        $context = \is_array($context) ? $context : [];

        $actor = (int) $row->actor_id > 0 ? get_userdata((int) $row->actor_id) : false;
        $who = $actor ? $actor->display_name : __('Someone', 'bit-connect');
        $title = (string) ($context['topic_title'] ?? '');
        $count = max(1, (int) $row->event_count);

        $sentence = self::sentence($type, $who, $title, $count, $context);
        $url = (string) ($context['url'] ?? '');

        return $url === '' ? '* ' . $sentence : '* ' . $sentence . "\n  " . $url;
    }

    /**
     * The wording for one notification.
     *
     * @param array<string, mixed> $context
     */
    private static function sentence(
        ?NotificationTypes $type,
        string $who,
        string $title,
        int $count,
        array $context
    ): string {
        $named = $title === '' ? __('a topic', 'bit-connect') : '"' . $title . '"';

        switch ($type) {
            case NotificationTypes::TOPIC_REPLY:
                // translators: 1: member name, 2: topic title
                return \sprintf(__('%1$s commented on %2$s', 'bit-connect'), $who, $named);

            case NotificationTypes::COMMENT_REPLY:
                // translators: 1: member name, 2: topic title
                return \sprintf(__('%1$s replied to you in %2$s', 'bit-connect'), $who, $named);

            case NotificationTypes::TOPIC_NEW:
                // translators: 1: member name, 2: topic title
                return \sprintf(__('%1$s posted a new topic: %2$s', 'bit-connect'), $who, $named);

            case NotificationTypes::MENTION:
                // translators: 1: member name, 2: topic title
                return \sprintf(__('%1$s mentioned you in %2$s', 'bit-connect'), $who, $named);

            case NotificationTypes::VOTE_RECEIVED:
                return $count > 1
                    // translators: 1: number of people, 2: topic title
                    ? \sprintf(__('%1$d people upvoted your post in %2$s', 'bit-connect'), $count, $named)
                    // translators: 1: member name, 2: topic title
                    : \sprintf(__('%1$s upvoted your post in %2$s', 'bit-connect'), $who, $named);

            case NotificationTypes::REPORT_RESOLVED:
                return \sprintf(
                    // translators: %1$s: the moderator's decision, e.g. "Dismissed"
                    __('A moderator reviewed something you reported — %1$s', 'bit-connect'),
                    (string) ($context['decision_label'] ?? '')
                );

            case NotificationTypes::CONTENT_ACTIONED:
                return __('Something you wrote was removed after review', 'bit-connect');

            case NotificationTypes::BADGE_AWARDED:
                return \sprintf(
                    // translators: %s: badge name
                    __('You were given the %s badge', 'bit-connect'),
                    (string) ($context['badge_label'] ?? '')
                );

            case NotificationTypes::TOPIC_STATUS_CHANGED:
                // translators: %s: topic title
                return \sprintf(__('The status changed on %s', 'bit-connect'), $named);

            case NotificationTypes::REPORT_FILED:
                return __('A new report is waiting in the moderation queue', 'bit-connect');

            default:
                return __('Something happened in the forum', 'bit-connect');
        }
    }

    /**
     * The subject line: what it is, and which forum it came from.
     *
     * @param array<int, object> $rows
     */
    private static function subject(array $rows, bool $isDigest): string
    {
        // May be empty: a site that never set a title has no blogname, and
        // fromName() has nothing to fall back to. Every branch below therefore
        // has a version without it — a subject ending in a dangling "— " looks
        // like the mail was cut off mid-send.
        $site = trim(NotificationSettings::fromName(NotificationPreferences::settings()));

        $count = \count($rows);

        if ($isDigest || $count > 1) {
            if ($site === '') {
                return \sprintf(
                    // translators: %d: number of notifications
                    _n('%d new notification', '%d new notifications', $count, 'bit-connect'),
                    $count
                );
            }

            return \sprintf(
                // translators: 1: number of notifications, 2: site name
                _n('%1$d new notification from %2$s', '%1$d new notifications from %2$s', $count, 'bit-connect'),
                $count,
                $site
            );
        }

        $type = NotificationTypes::tryFrom((string) $rows[0]->type);

        // phpcs:ignore WordPress.WP.I18n.NonSingularStringLiteralText -- labels are English literals defined in #[Label] attributes; translated here at the read site
        $label = $type ? __($type->label(), 'bit-connect') : __('Forum notification', 'bit-connect');

        if ($site === '') {
            return $label;
        }

        // translators: 1: what happened, 2: site name
        return \sprintf(__('%1$s — %2$s', 'bit-connect'), $label, $site);
    }

    /**
     * The message: a greeting, a line per notification, and how to stop.
     *
     * The unsubscribe pointer is not decoration. Mail a member cannot see how to
     * turn off is mail they mark as spam, and that costs the forum every other
     * message it sends.
     *
     * @param array<int, object> $rows
     */
    private static function body(string $name, array $rows, bool $isDigest): string
    {
        $settings = NotificationPreferences::settings();
        $url = AuthService::getForumPageUrl();

        // The admin's wording, with the built-in text as the fallback. Every
        // line goes through the same token pass, so {name} works wherever an
        // admin puts it rather than only where we happened to expect it.
        $tokens = [
            '{name}'  => $name,
            '{site}'  => NotificationSettings::fromName($settings),
            '{count}' => \count($rows),
            '{url}'   => $url,
        ];

        $render = static fn (string $template): string => NotificationSettings::renderTemplate(
            $template,
            $tokens
        );

        $opening = $isDigest
            ? NotificationSettings::mailDigestIntro($settings)
            : NotificationSettings::mailIntro($settings);

        return $render(NotificationSettings::mailGreeting($settings))
            . "\n\n" . $render($opening) . "\n\n"
            . implode("\n\n", array_map([self::class, 'line'], $rows))
            . "\n\n---\n"
            . $render(NotificationSettings::mailFooter($settings))
            . "\n" . $url;
    }

    /**
     * Marks rows as mailed so nothing sends them twice.
     *
     * Written through $wpdb: QueryBuilder::update() builds a statement and
     * returns without executing, and save() on a fetched row emits a mismatched
     * column list. Both fail quietly, and the failure here would be every
     * digest re-sending the whole backlog.
     *
     * @param array<int, object> $rows
     */
    private static function stamp(array $rows): void
    {
        $ids = array_values(
            array_filter(
                array_map(static fn ($row): int => (int) $row->id, $rows),
                static fn (int $id): bool => $id > 0
            )
        );

        if ($ids === []) {
            return;
        }


        $table = Config::withDBPrefix('notifications');
        $placeholders = implode(',', array_fill(0, \count($ids), '%d'));
        $now = current_time('mysql', true);

        Connection::query(
            Connection::prepare(
                "UPDATE {$table} SET emailed_at = %s WHERE emailed_at IS NULL AND id IN ({$placeholders})",
                $now,
                ...$ids
            )
        );
    }
}
