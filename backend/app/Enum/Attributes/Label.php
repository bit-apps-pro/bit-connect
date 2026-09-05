<?php

namespace BitApps\BitConnect\Enum\Attributes;

if (!\defined('ABSPATH')) {
    exit;
}

use Attribute;

/**
 * Human-readable label for an enum case (e.g. admin UI, select options).
 */
#[Attribute(Attribute::TARGET_CLASS_CONSTANT)]
final class Label
{
    public string $value;

    public function __construct(string $value)
    {
        $this->value = $value;
    }
}
