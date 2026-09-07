<?php

namespace BitApps\BitConnect\Enum;

// Prevent direct script access
if (!defined('ABSPATH')) {
    exit;
}

use BitApps\BitConnect\Enum\Attributes\Label;
use BitApps\BitConnect\Enum\Concerns\EnumHelper;

/**
 * How a badge looks, independent of what it says.
 *
 * The portal colours a badge by tone rather than by its printed label, so a
 * forum can call the same standing Moderator, Team or Staff and keep its
 * colour. That indirection only works if the set of tones is closed: `tone`
 * reaches the client as a CSS key, and an unknown one would render an unstyled
 * pill. Every value here has a matching entry in the portal's TONE_STYLES map
 * and a token pair in frontend/shared/theme/tokens.css.
 *
 * ADMIN and MODERATOR predate the badge catalog and are what the capability
 * fallback still resolves to — they are listed here so an admin naming a
 * "Staff" badge can reach for the same red the automatic Admin badge uses. The
 * remaining tones carry no meaning of their own; they exist so Developer,
 * Support and Expert can be told apart at a glance.
 */
enum BadgeTone: string
{
    use EnumHelper;

    #[Label('Red')]
    case ADMIN = 'admin';

    #[Label('Blue')]
    case MODERATOR = 'moderator';

    #[Label('Green')]
    case GREEN = 'green';

    #[Label('Violet')]
    case VIOLET = 'violet';

    #[Label('Amber')]
    case AMBER = 'amber';

    #[Label('Teal')]
    case TEAL = 'teal';

    #[Label('Grey')]
    case NEUTRAL = 'neutral';

    /**
     * The label, translated.
     *
     * A match over literals rather than __($tone->label()): `wp i18n make-pot`
     * reads source, not runtime, so a __() whose argument is an expression puts
     * nothing in the catalog — and a lookup the catalog does not hold returns
     * the English string in every locale. The Pro add-on's badge catalog screen
     * wrapped `options()` at the read site, which translated none of these.
     *
     * The #[Label] attributes above remain the English wording every non-display
     * reader gets. EnumLabelTranslationTest asserts the two agree case by case,
     * so a reworded attribute cannot silently leave this behind.
     *
     * Static and typed by parameter rather than `self`: the coding standard's
     * sniff does not treat an enum as class scope.
     */
    public static function translatedLabel(BadgeTone $tone): string
    {
        return match ($tone) {
            self::ADMIN     => __('Red', 'bit-connect'),
            self::MODERATOR => __('Blue', 'bit-connect'),
            self::GREEN     => __('Green', 'bit-connect'),
            self::VIOLET    => __('Violet', 'bit-connect'),
            self::AMBER     => __('Amber', 'bit-connect'),
            self::TEAL      => __('Teal', 'bit-connect'),
            self::NEUTRAL   => __('Grey', 'bit-connect'),
        };
    }

    /**
     * Every tone as a value/label pair, with the label translated.
     *
     * `EnumHelper::options()` returns the raw #[Label] wording, which is what
     * non-display readers want. This is the display copy, so the Pro badge
     * catalog can render the list without wrapping it in a __() the extractor
     * cannot read.
     *
     * @return array<int, array{value: int|string, label: string}>
     */
    public static function translatedOptions(): array
    {
        return array_map(
            static fn (self $case): array => [
                'value' => $case->value,
                'label' => self::translatedLabel($case),
            ],
            self::cases()
        );
    }

    /**
     * The tone a badge falls back to when the stored one is unknown.
     *
     * Unknown rather than absent: a badge saved under a tone that a later
     * release removed still has to render, and rendering it grey is better than
     * rendering it unstyled.
     */
    public static function fallback(): self
    {
        return self::NEUTRAL;
    }

    /**
     * Whether a string names a tone the portal knows how to style.
     */
    public static function isKnown(string $tone): bool
    {
        return self::tryFrom($tone) instanceof self;
    }
}
