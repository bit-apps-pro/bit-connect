<?php

namespace BitApps\BitConnect\Services;

// Prevent direct script access
if (!defined('ABSPATH')) {
    exit;
}

use BitApps\BitConnect\Config;
use BitApps\BitConnect\Deps\BitApps\WPDatabase\Connection;
use BitApps\BitConnect\Enum\NotificationSettings;
use BitApps\BitConnect\Model\Notification;

/**
 * The batched email path: everything a member missed, in one message.
 *
 * Runs hourly and decides per member whether their turn has come, rather than
 * running once a day at a fixed time. Members are on daily or weekly cadences
 * and admins choose the hour, so the job has to wake often enough to catch
 * whichever hour that is.
 *
 * The rule that keeps the sweep from growing without bound: **every member this
 * job looks at leaves with `emailed_at` set**, including the ones who wanted no
 * mail at all. A row left null is a row every future run re-reads, so "never"
 * has to be stamped rather than skipped — otherwise the one setting that means
 * "leave me alone" is the setting that makes the job slowest.
 */
final class NotificationDigest
{
    /**
     * How many members one run will mail.
     *
     * A cap, not a policy. A forum whose mail has been broken for a week should
     * send what it can and return for the rest next hour, rather than time the
     * cron out and send nothing — which would repeat forever.
     */
    private const USERS_PER_RUN = 200;

    /**
     * The most notifications one email will list.
     *
     * Past this the mail stops being readable, and the remainder rides the next
     * one rather than being lost — the rows over the limit keep `emailed_at`
     * null, so the next run picks them up.
     */
    private const ROWS_PER_EMAIL = 50;

    /**
     * When this member was last sent a digest (unix seconds).
     */
    private const META_LAST_SENT = 'bit_connect_last_digest';

    /**
     * The hourly sweep.
     *
     * @return int how many members were mailed
     */
    public static function run(): int
    {
        if (!NotificationSettings::isEnabled(NotificationPreferences::settings())) {
            return 0;
        }

        $sent = 0;

        foreach (Notification::userIdsOwingEmail(self::USERS_PER_RUN) as $userId) {
            if (self::processMember($userId)) {
                ++$sent;
            }
        }

        return $sent;
    }

    /**
     * Deletes read notifications past the retention age.
     *
     * Its own hook rather than a tail-call on the digest: the two have nothing
     * to do with each other, and a forum that has switched email off entirely
     * still needs its table pruned.
     */
    public static function cleanup(): int
    {
        return NotificationService::pruneRead();
    }

    /**
     * One member's turn, or not yet.
     *
     * @return bool whether mail was sent
     */
    private static function processMember(int $userId): bool
    {
        $frequency = NotificationPreferences::frequencyFor($userId);

        if ($frequency === NotificationSettings::FREQUENCY_NEVER) {
            // Stamped, not skipped. See the class note: a row left null is one
            // every future run re-reads.
            self::stampAll($userId);

            return false;
        }

        $rows = Notification::owingEmailForUser($userId, self::ROWS_PER_EMAIL);

        if ($rows === []) {
            return false;
        }

        // Instant members whose rows are still here were queued in a request
        // that died before shutdown ran. This is the repair path: an hour late
        // is worse than immediate and far better than never.
        if ($frequency === NotificationSettings::FREQUENCY_INSTANT) {
            return NotificationMailer::deliver($userId, $rows, false);
        }

        if (!self::isDue($userId, $frequency)) {
            return false;
        }

        $delivered = NotificationMailer::deliver($userId, $rows, true);

        // Recorded whether or not the send succeeded, for the same reason the
        // mailer stamps regardless: a broken mail setup must not make this
        // member's digest retry every hour.
        update_user_meta($userId, self::META_LAST_SENT, time());

        return $delivered;
    }

    /**
     * Whether enough time has passed, and whether this is the right hour.
     *
     * Both, but not strictly. The hour is what makes a digest arrive at a
     * civilised time instead of whenever the member happened to first be
     * notified; the elapsed check is what stops it going out twice. The
     * catch-up clause exists because WP-Cron is triggered by traffic, not by a
     * clock — a quiet forum can miss the chosen hour entirely, and without it
     * a daily digest would then wait another full day.
     */
    private static function isDue(int $userId, string $frequency): bool
    {
        $interval = $frequency === NotificationSettings::FREQUENCY_WEEKLY
            ? WEEK_IN_SECONDS
            : DAY_IN_SECONDS;

        $last = (int) get_user_meta($userId, self::META_LAST_SENT, true);
        $elapsed = time() - $last;

        if ($elapsed < $interval) {
            return false;
        }

        $hour = (int) current_time('G');
        $wanted = NotificationSettings::digestHour(NotificationPreferences::settings());

        // Half an interval past due, the chosen hour has plainly been missed.
        return $hour === $wanted || $elapsed >= $interval + ($interval / 2);
    }

    /**
     * Marks everything waiting for this member as dealt with, sending nothing.
     */
    private static function stampAll(int $userId): void
    {
        Connection::query(
            Connection::prepare(
                'UPDATE ' . Config::withDBPrefix('notifications') . '
                 SET emailed_at = %s
                 WHERE user_id = %d AND emailed_at IS NULL',
                current_time('mysql', true),
                $userId
            )
        );
    }
}
