<?php

namespace BitApps\BitConnect\Enum;

// Prevent direct script access
if (!\defined('ABSPATH')) {
    exit;
}


/**
 * Enum for Post Types.
 */
enum PostTypes: string
{
    case BIT_CONNECT = 'bit-connect';
}
