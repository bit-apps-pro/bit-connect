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
