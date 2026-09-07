<?php

// phpcs:disable Squiz.NamingConventions.ValidVariableName.NotCamelCaps

namespace BitApps\BitConnect\Views;

use BitApps\BitConnect\Config;
use BitApps\BitConnect\Deps\BitApps\WPKit\Hooks\Hooks;
use BitApps\BitConnect\Deps\BitApps\WPKit\Utils\Capabilities;

if (!defined('ABSPATH')) {
    exit;
}


/**
 * The admin Layout and page handler class.
 */
final class Layout
{
    public function __construct()
    {
        Hooks::addAction('in_admin_header', [$this, 'removeAdminNotices']);
        Hooks::addAction('admin_menu', [$this, 'sideBarMenuItem']);
        Hooks::addAction('admin_enqueue_scripts', [new Head(), 'addHeadScripts'], 0);
    }

    /**
     * Register the admin left sidebar menu item.
     */
    public function sideBarMenuItem()
    {
        $menus = Hooks::applyFilter(Config::withPrefix('admin_sidebar_menu'), Config::get('SIDE_BAR_MENU'));
        global $submenu;

        foreach ($menus as $menu) {
            if (isset($menu['capability']) && Capabilities::check($menu['capability'])) {
                if ($menu['type'] === 'menu') {
                    add_menu_page(
                        $menu['title'],
                        $menu['name'],
                        $menu['capability'],
                        $menu['slug'],
                        $menu['callback'],
                        $menu['icon'],
                        $menu['position']
                    );
                } else {
                    $submenu[$menu['parent']][] = [$menu['name'], $menu['capability'], 'admin.php?page=' . $menu['slug']];
                }
            }
        }
    }

    /**
     * Names WordPress core prints its own notices under.
     *
     * These survive the clear-out below. They are how a site is told its
     * WordPress is out of date, that it is stuck in maintenance mode, or that
     * a core update failed — warnings an administrator must not miss because
     * they happened to be looking at this plugin's screen when they fired.
     */
    private const CORE_NOTICES = [
        'update_nag',
        'maintenance_nag',
        'site_admin_notice',
    ];

    /**
     * Quieten third-party notices on this plugin's own screens.
     *
     * The admin UI is a single full-page React app, and other plugins' notices
     * print above it — outside the app's root, in its typography, with no
     * layout that accounts for them. Clearing them is scoped as tightly as it
     * can be: only on a page belonging to this plugin, never anywhere else in
     * wp-admin, and core's own warnings are put straight back.
     *
     * The narrowness matters beyond tidiness. Removing every notice everywhere
     * would hide security and update warnings the site owner is entitled to
     * see, which is what the plugin directory guidelines are asking about when
     * they say a plugin may not take over the admin.
     */
    public function removeAdminNotices()
    {
        global $plugin_page, $wp_filter;

        if (empty($plugin_page) || strpos($plugin_page, Config::SLUG) === false) {
            return;
        }

        $preserved = [];

        foreach (['admin_notices', 'all_admin_notices'] as $hook) {
            if (!isset($wp_filter[$hook])) {
                continue;
            }

            foreach ($wp_filter[$hook]->callbacks as $priority => $callbacks) {
                foreach ($callbacks as $callback) {
                    if (\is_string($callback['function']) && \in_array($callback['function'], self::CORE_NOTICES, true)) {
                        $preserved[] = [$hook, $callback['function'], $priority, $callback['accepted_args']];
                    }
                }
            }
        }

        remove_all_actions('admin_notices');
        remove_all_actions('all_admin_notices');

        foreach ($preserved as [$hook, $function, $priority, $acceptedArgs]) {
            Hooks::addAction($hook, $function, $priority, $acceptedArgs);
        }
    }
}
