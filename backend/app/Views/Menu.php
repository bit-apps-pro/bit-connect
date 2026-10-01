<?php

namespace BitApps\BitConnect\Views;

use BitApps\BitConnect\Config;
use BitApps\BitConnect\Enum\Capabilities;
use BitApps\BitConnect\Services\AdminAccessService;
use BitApps\BitConnect\Services\ReportService;

if (!defined('ABSPATH')) {
    exit;
}


final class Menu
{
    /**
     * Provides menus for wordpress admin sidebar.
     * should return an array of menus with the following structure:
     * [
     *   'type' => menu | submenu,
     *  'name' => 'Name of menu will shown in sidebar',
     *  'capability' => 'capability required to access menu',
     *  'slug' => 'slug of menu after ?page=',.
     *
     *  'title' => 'page title will be shown in browser title if type is menu',
     *  'callback' => 'function to call when menu is clicked',
     *  'icon' =>   'icon to display in menu if menu type is menu',
     *  'position' => 'position of menu in sidebar if menu type is menu',
     *
     * 'parent' => 'parent slug if submenu'
     * ]
     *
     * @return array
     */
    public static function getSideBarMenu(Body $body)
    {
        return [
            'Home'        => self::getHomeMenuAttributes($body),
            'Dashboard'   => self::getDashboardMenuAttributes(),
            'General'     => self::getGeneralMenuAttributes(),
            'Stages'      => self::getStagesMenuAttributes(),
            'Topic Types' => self::getTopicTypesMenuAttributes(),
            'Tags'        => self::getTagsMenuAttributes(),
            'Status'      => self::getStatusMenuAttributes(),
            'Manager'     => self::getManagerMenuAttributes(),
            'Activity'    => self::getActivityMenuAttributes(),
            'Reports'     => self::getReportsMenuAttributes(),
            'Settings'    => self::getSettingsMenuAttributes(),
            'Support'     => self::getSupportMenuAttributes(),
        ];
    }

    private static function getHomeMenuAttributes(Body $body)
    {
        // phpcs:ignore Generic.Files.LineLength.MaxExceeded
        $icon = 'data:image/svg+xml;base64,' . base64_encode('<svg width="20" height="20" viewBox="85 86 360 360" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M284.966 348.289H372.14C379.935 348.289 384.752 356.747 380.816 363.476C348.981 417.917 295.95 450.139 242.507 441.034C196.885 433.273 161.509 397.183 144.651 348.289C133.928 317.175 130.689 280.875 137.083 243.367C140.691 222.163 147.076 202.344 155.635 184.454C186.002 120.951 243.741 81.7986 301.991 91.7084C343.107 98.7065 375.891 128.696 394.309 170.349C397.246 176.986 392.337 184.454 385.079 184.454H319.31C314.871 184.454 310.995 181.542 309.677 177.305C301.412 150.823 285.914 132.774 265.364 129.661C238.597 125.6 209.38 147.567 188.36 184.454C177.401 203.678 168.666 226.963 163.657 252.715C156.474 289.694 158.547 323.376 167.517 348.289C177.334 375.568 195.417 392.333 218.643 391.393C239.294 390.554 259.902 375.685 276.835 352.476C278.74 349.866 281.752 348.297 284.983 348.297L284.966 348.289Z" fill="white"/><path d="M350.024 327.688C370.41 327.688 386.936 311.162 386.936 290.776C386.936 270.39 370.41 253.864 350.024 253.864C329.638 253.864 313.112 270.39 313.112 290.776C313.112 311.162 329.638 327.688 350.024 327.688Z" fill="white"/></svg>');

        return [
            'type'  => 'menu',
            'title' => __('Bit Connect', 'bit-connect'),
            'name'  => __('Bit Connect', 'bit-connect'),
            // Derived, not grantable: WordPress takes one capability string per
            // entry and cannot say "manage or moderate". Gating the parent on
            // bit_connect_forum_manage alone would hide the whole menu from a moderator,
            // and with it the Activity screen that is theirs to read.
            'capability' => AdminAccessService::CAP,
            'slug'       => Config::SLUG,
            'callback'   => [$body, 'render'],
            'icon'       => $icon,
            'position'   => '20',
        ];
    }

    private static function getDashboardMenuAttributes()
    {
        return [
            'parent'     => Config::SLUG,
            'type'       => 'submenu',
            'name'       => 'Dashboard',
            'capability' => Capabilities::MANAGE->value,
            'slug'       => Config::SLUG . '#/',
        ];
    }

    private static function getStagesMenuAttributes()
    {
        return [
            'parent'     => Config::SLUG,
            'type'       => 'submenu',
            'name'       => 'Stages',
            'capability' => Capabilities::MANAGE->value,
            'slug'       => Config::SLUG . '#/stages',
        ];
    }

    private static function getTopicTypesMenuAttributes()
    {
        return [
            'parent'     => Config::SLUG,
            'type'       => 'submenu',
            'name'       => 'Topic Types',
            'capability' => Capabilities::MANAGE->value,
            'slug'       => Config::SLUG . '#/topic-types',
        ];
    }

    private static function getTagsMenuAttributes()
    {
        return [
            'parent'     => Config::SLUG,
            'type'       => 'submenu',
            'name'       => 'Tags',
            'capability' => Capabilities::MANAGE->value,
            'slug'       => Config::SLUG . '#/tags',
        ];
    }

    private static function getStatusMenuAttributes()
    {
        return [
            'parent'     => Config::SLUG,
            'type'       => 'submenu',
            'name'       => 'Status',
            'capability' => Capabilities::MANAGE->value,
            'slug'       => Config::SLUG . '#/status',
        ];
    }

    /**
     * The one screen under this menu that answers to bit_connect_forum_moderate.
     *
     * Everything else here is settings and belongs to bit_connect_forum_manage; reviewing
     * what was done to a member's post does not.
     */
    private static function getActivityMenuAttributes()
    {
        return [
            'parent'     => Config::SLUG,
            'type'       => 'submenu',
            'name'       => 'Activity',
            'capability' => Capabilities::MODERATE->value,
            'slug'       => Config::SLUG . '#/activity',
        ];
    }

    /**
     * The moderation queue. bit_connect_forum_moderate, like Activity — working through
     * reports is not an administrative act.
     *
     * Carries the waiting count as a bubble, in the markup core uses for
     * Comments, because nothing else told a moderator a report existed: content
     * is taken out of public view the moment the threshold is met, and the queue
     * was only ever seen by someone who went looking for it.
     */
    private static function getReportsMenuAttributes()
    {
        $pending = ReportService::pendingTargetCount();

        return [
            'parent'     => Config::SLUG,
            'type'       => 'submenu',
            'name'       => 'Reports' . self::pendingBubble($pending),
            'capability' => Capabilities::MODERATE->value,
            'slug'       => Config::SLUG . '#/reports',
        ];
    }

    /**
     * The count bubble, or nothing at all when the queue is empty.
     *
     * A zero bubble is noise; the absence of one is the same information.
     */
    private static function pendingBubble(int $pending): string
    {
        if ($pending <= 0) {
            return '';
        }

        return \sprintf(
            ' <span class="awaiting-mod count-%1$s"><span class="pending-count">%2$s</span></span>',
            esc_attr((string) $pending),
            esc_html(number_format_i18n($pending))
        );
    }

    private static function getManagerMenuAttributes()
    {
        return [
            'parent'     => Config::SLUG,
            'type'       => 'submenu',
            'name'       => 'Manager',
            'capability' => Capabilities::MANAGE->value,
            'slug'       => Config::SLUG . '#/manager',
        ];
    }

    private static function getGeneralMenuAttributes()
    {
        return [
            'parent'     => Config::SLUG,
            'type'       => 'submenu',
            'name'       => 'General',
            'capability' => Capabilities::MANAGE->value,
            'slug'       => Config::SLUG . '#/general',
        ];
    }

    private static function getSettingsMenuAttributes()
    {
        return [
            'parent'     => Config::SLUG,
            'type'       => 'submenu',
            'name'       => 'Settings',
            'capability' => Capabilities::MANAGE->value,
            'slug'       => Config::SLUG . '#/settings',
        ];
    }

    /**
     * Support.
     *
     * Last in the list: it is the one entry here about the plugin rather than
     * about the forum — support and the changelog. The entries pass through
     * the `admin_sidebar_menu` filter, so another plugin can adjust this one
     * like any other.
     */
    private static function getSupportMenuAttributes()
    {
        return [
            'parent'     => Config::SLUG,
            'type'       => 'submenu',
            'name'       => 'Support',
            'capability' => Capabilities::MANAGE->value,
            'slug'       => Config::SLUG . '#/support',
        ];
    }
}
