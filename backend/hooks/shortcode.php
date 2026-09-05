<?php

use BitApps\BitConnect\Deps\BitApps\WPKit\Shortcode\Shortcode as WPKitShortcode;
use BitApps\BitConnect\Views\ShortCode;

if (!defined('ABSPATH')) {
    exit;
}

WPKitShortcode::addShortcode('bit-connect', [new ShortCode(), 'render']);
