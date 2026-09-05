<?php

/**
 * Plugin Name:  Bit Connect
 * Plugin URI:   https://bitapps.pro/bit-connect
 * Description:  A plugin connect user to product development process. User will be able to add feature requests, create issues. Also will be able send feedback. Add ideas on features in roadmap to improve features.
 * Version:     1.0.0
 * Author:       Bit Apps
 * Author URI:   https://bitapps.pro
 * Text Domain:  bit-connect
 * Requires PHP: 8.2
 * Requires at least: 6.8
 * Domain Path:  /languages
 * License:      GPL-2.0-or-later
 * License URI:  https://www.gnu.org/licenses/gpl-2.0.html
 */
if (!defined('ABSPATH')) {
    exit;
} // Exit if accessed directly

require_once plugin_dir_path(__FILE__) . 'backend/bootstrap.php';
