<?php

namespace BitApps\BitConnect\Enum;

// Prevent direct script access
if (!\defined('ABSPATH')) {
    exit;
}

enum AdminSettings: string
{
    case OPTION_NAME = 'admin_settings';
}
