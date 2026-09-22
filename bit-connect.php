<?php

/**
 * Plugin Name:  Bit Connect – Community, Discussion Forum, Feedback & Roadmap
 * Plugin URI:   https://bitapps.pro/bit-connect
 * Description:  A community forum for WordPress where users raise feature requests, report issues, send feedback and vote on what gets built next.
 * Version:     1.0.1
 * Author:       Bit Apps
 * Author URI:   https://bitapps.pro
 * Text Domain:  bit-connect
 * Requires PHP: 8.2
 * Requires at least: 6.8
 * Domain Path:  /languages
 * License:      GPL-2.0-or-later
 * License URI:  https://www.gnu.org/licenses/gpl-2.0.html
 *
 * The JavaScript and CSS under assets/ are compiled bundles. Their human-readable
 * source and build instructions are public at
 * https://github.com/bit-apps-pro/bit-connect
 */
if (!defined('ABSPATH')) {
    exit;
} // Exit if accessed directly

require_once plugin_dir_path(__FILE__) . 'backend/bootstrap.php';
