<?php

namespace BitApps\BitConnect\Enum;

// Prevent direct script access
if (!defined('ABSPATH')) {
    exit;
}

use BitApps\BitConnect\Enum\Attributes\Label;
use BitApps\BitConnect\Enum\Concerns\EnumHelper;

/**
 * Why a member reported something.
 *
 * A short fixed list on purpose. Reasons exist so a moderator can triage a queue
 * at a glance and so the same complaint reads the same way from every reporter;
 * a free-text box alone gives neither. OTHER carries the cases the list misses,
 * and is the one reason that requires the reporter to write something.
 */
enum ReportReasons: string
{
    use EnumHelper;

    #[Label('Spam or advertising')]
    case SPAM = 'spam';

    #[Label('Abusive or hateful')]
    case ABUSE = 'abuse';

    #[Label('Harassment of a member')]
    case HARASSMENT = 'harassment';

    #[Label('Off topic for this forum')]
    case OFF_TOPIC = 'off_topic';

    #[Label('Illegal content')]
    case ILLEGAL = 'illegal';

    #[Label('Something else')]
    case OTHER = 'other';

    /**
     * Whether this reason is meaningless without the reporter explaining.
     *
     * Static and named rather than an instance method on $this: the coding
     * standard's sniff does not treat an enum as class scope, rejecting both
     * $this and a `self` type hint inside one.
     */
    public static function requiresDetails(ReportReasons $reason): bool
    {
        return $reason === self::OTHER;
    }
}
