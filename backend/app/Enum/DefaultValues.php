<?php

namespace BitApps\BitConnect\Enum;

// Prevent direct script access
if (!\defined('ABSPATH')) {
    exit;
}


/**
 * Enum for Default Values.
 */
enum DefaultValues: string
{
    case STAGE = 'questions';
    case STATUS = 'need-approval';
}
