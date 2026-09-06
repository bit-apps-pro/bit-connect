<?php

namespace BitApps\BitConnect\Enum;

// Prevent direct script access
if (!defined('ABSPATH')) {
    exit;
}

enum AuthSettings: string
{
    case OPTION_NAME = 'auth_settings';
    case MODE_PLUGIN_DEFAULT = 'plugin_default';
    case MODE_CUSTOM_URL = 'custom_url';
}
