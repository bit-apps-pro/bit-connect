<?php

namespace BitApps\BitConnect\Enum\Attributes;

if (!\defined('ABSPATH')) {
    exit;
}

use Attribute;

/**
 * Longer human-readable description for an enum case.
 */
#[Attribute(Attribute::TARGET_CLASS_CONSTANT)]
final class Description
{
    public string $value;

    public function __construct(string $value)
    {
        $this->value = $value;
    }
}
