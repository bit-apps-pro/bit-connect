<?php

namespace BitApps\BitConnect\Enum;

// Prevent direct script access
if (!defined('ABSPATH')) {
    exit;
}

/**
 * How the topic form treats one of its optional fields.
 */
enum TopicFieldMode: string
{
    /** Not asked. New topics carry no term for it. */
    case HIDDEN = 'hidden';

    /** Asked, and may be left blank. */
    case OPTIONAL = 'optional';

    /** Asked, and a topic cannot be created without it. */
    case REQUIRED = 'required';

    /**
     * @return list<string>
     */
    public static function values(): array
    {
        return array_map(static fn (self $mode) => $mode->value, self::cases());
    }
}
