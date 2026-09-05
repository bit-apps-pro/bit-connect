<?php

namespace BitApps\BitConnect\Enum\Attributes;

if (!defined('ABSPATH')) {
    exit;
}

use Attribute;

/**
 * User-facing message for an enum case (e.g. error/notice text).
 */
#[Attribute(Attribute::TARGET_CLASS_CONSTANT)]
final class Message
{
    public string $value;

    public function __construct(string $value)
    {
        $this->value = $value;
    }
}
