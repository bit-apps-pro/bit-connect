<?php

namespace BitApps\BitConnect\Services;

// Prevent direct script access
if (!defined('ABSPATH')) {
    exit;
}

use DateTimeImmutable;
use DateTimeZone;

/**
 * Report periods on the site's calendar — the timezone set under Settings →
 * General — expressed as the GMT instants the tables store.
 *
 * A "day" on the dashboard is the site's day: a topic posted at 02:00 in Dhaka
 * belongs to that Dhaka date, not to the previous one it falls on in London.
 * Every boundary is worked out as a local midnight and only then converted, so
 * a daylight-saving change inside the period moves the boundary with it.
 */
final class SiteCalendar
{
    /**
     * The local midnight each bucket of a period starts at, oldest first: one a
     * day for `7d` and `30d`, one a month for `12m`.
     *
     * @return list<DateTimeImmutable>
     */
    public static function bucketStarts(string $period): array
    {
        $today = new DateTimeImmutable('today', wp_timezone());

        if ($period === '12m') {
            $first = $today->modify('first day of this month')->modify('-11 months');

            return array_map(static fn (int $i) => $first->modify("+{$i} months"), range(0, 11));
        }

        $count = $period === '7d' ? 7 : 30;
        $first = $today->modify('-' . ($count - 1) . ' days');

        return array_map(static fn (int $i) => $first->modify("+{$i} days"), range(0, $count - 1));
    }

    /** The GMT instant a period starts at: the site's midnight on its first day. */
    public static function periodStart(string $period): string
    {
        return self::toGmt(self::bucketStarts($period)[0]);
    }

    /** A moment as the `Y-m-d H:i:s` GMT string the tables store. */
    public static function toGmt(DateTimeImmutable $at): string
    {
        return $at->setTimezone(new DateTimeZone('UTC'))->format('Y-m-d H:i:s');
    }
}
