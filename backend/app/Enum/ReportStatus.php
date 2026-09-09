<?php

namespace BitApps\BitConnect\Enum;

// Prevent direct script access
if (!defined('ABSPATH')) {
    exit;
}

use BitApps\BitConnect\Enum\Attributes\Label;
use BitApps\BitConnect\Enum\Concerns\EnumHelper;

/**
 * Where a report has got to.
 *
 * Three ways to finish, not one, because "resolved" alone loses the answer a
 * moderator actually gave. Whether the content stayed up decides whether it is
 * restored, whether the author hears anything, and — later — whether a reporter
 * is reporting things that turn out to be worth removing.
 */
enum ReportStatus: string
{
    use EnumHelper;

    #[Label('Awaiting review')]
    case PENDING = 'pending';

    // Reviewed, the content stays. Anything hidden by the report comes back.
    #[Label('Reviewed — content kept')]
    case RESOLVED_KEPT = 'resolved_kept';

    // Reviewed, the content goes. It stays hidden.
    #[Label('Reviewed — content removed')]
    case RESOLVED_REMOVED = 'resolved_removed';

    // Not a real problem. Same effect on the content as kept.
    #[Label('Dismissed')]
    case DISMISSED = 'dismissed';

    /**
     * The label, translated.
     *
     * A match over literals rather than __($status->label()): `wp i18n make-pot`
     * reads source, not runtime, so a __() whose argument is an expression puts
     * nothing in the catalog — and a lookup the catalog does not hold returns
     * the English string in every locale. Wrapping at the read site translated
     * none of these; this does.
     *
     * The #[Label] attributes above remain the English wording every non-display
     * reader gets. EnumLabelTranslationTest asserts the two agree case
     * by case, so a reworded attribute cannot silently leave this behind.
     *
     * Static and typed by parameter rather than `self`: the coding standard's
     * sniff does not treat an enum as class scope.
     */
    public static function translatedLabel(ReportStatus $status): string
    {
        return match ($status) {
            self::PENDING          => __('Awaiting review', 'bit-connect'),
            self::RESOLVED_KEPT    => __('Reviewed — content kept', 'bit-connect'),
            self::RESOLVED_REMOVED => __('Reviewed — content removed', 'bit-connect'),
            self::DISMISSED        => __('Dismissed', 'bit-connect'),
        };
    }

    /**
     * Statuses that end a report's life in the queue.
     *
     * @return array<int, self>
     */
    public static function closed(): array
    {
        return [self::RESOLVED_KEPT, self::RESOLVED_REMOVED, self::DISMISSED];
    }

    /**
     * Whether reaching this status should put hidden content back in public.
     *
     * Static and named rather than an instance method on $this: the coding
     * standard's sniff does not treat an enum as class scope.
     *
     * Only removal keeps it down. Both of the other endings mean the report did
     * not stand up, and content taken out of sight while it was reviewed has to
     * come back — otherwise reporting something is enough to bury it.
     */
    public static function restoresContent(ReportStatus $status): bool
    {
        return $status === self::RESOLVED_KEPT || $status === self::DISMISSED;
    }
}
