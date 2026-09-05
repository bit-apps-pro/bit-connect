<?php

namespace BitApps\BitConnect\Views;

use BitApps\BitConnect\Config;
use BitApps\BitConnect\Enum\Capabilities;
use BitApps\BitConnect\Services\AdminAccessService;
use BitApps\BitConnect\Services\ReportService;

if (!\defined('ABSPATH')) {
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
            'Products'    => self::getProductsMenuAttributes(),
            'Tags'        => self::getTagsMenuAttributes(),
            'Status'      => self::getStatusMenuAttributes(),
            'Manager'     => self::getManagerMenuAttributes(),
            'Activity'    => self::getActivityMenuAttributes(),
            'Reports'     => self::getReportsMenuAttributes(),
            'Settings'    => self::getSettingsMenuAttributes(),
            'License'     => self::getLicenseMenuAttributes(),
        ];
    }

    private static function getHomeMenuAttributes(Body $body)
    {
        // phpcs:ignore Generic.Files.LineLength.MaxExceeded
        $icon = 'data:image/svg+xml;base64,' . base64_encode('<svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M19.7995 7.9998H15.658C14.8343 5.66984 12.6119 3.99943 9.99971 3.99943C9.29795 3.99943 8.62498 4.11943 8 4.34119V0.200649C8.64608 0.0691322 9.31522 0 9.99971 0C14.8382 0 18.8731 3.43493 19.7995 7.9998Z" fill="white"/><path d="M19.7993 12C18.8729 16.5648 14.837 19.9998 9.9995 19.9998C4.47654 19.9998 0 15.5223 0 9.9993C0 6.72757 1.57058 3.82354 3.99941 1.99951V9.9993C3.99941 13.3133 6.68649 15.9994 9.9995 15.9994C12.6117 15.9994 14.8341 14.3299 15.6578 12L19.7993 12Z" fill="white"/><path d="M12.0004 9.99921C12.0004 11.1042 11.1047 11.9999 9.99971 11.9999C8.8957 11.9999 8 11.1042 8 9.99921C8 8.89519 8.8957 7.99951 9.99971 7.99951C11.1047 7.99951 12.0004 8.89519 12.0004 9.99921Z" fill="white"/></svg>');

        return [
            'type'  => 'menu',
            'title' => __('Bit Connect', 'bit-connect'),
            'name'  => __('Bit Connect', 'bit-connect'),
            // Derived, not grantable: WordPress takes one capability string per
            // entry and cannot say "manage or moderate". Gating the parent on
            // forum_manage alone would hide the whole menu from a moderator,
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

    private static function getProductsMenuAttributes()
    {
        return [
            'parent'     => Config::SLUG,
            'type'       => 'submenu',
            'name'       => 'Products',
            'capability' => Capabilities::MANAGE->value,
            'slug'       => Config::SLUG . '#/products',
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
     * The one screen under this menu that answers to forum_moderate.
     *
     * Everything else here is settings and belongs to forum_manage; reviewing
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
     * The moderation queue. forum_moderate, like Activity — working through
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
     * License, updates and support.
     *
     * Present in both editions and last in the list. It is the one entry here
     * about the plugin rather than about the forum, and in the free edition it
     * is where somebody goes to find out what Pro is — so hiding it when no
     * licence exists would hide the only route to buying one.
     */
    private static function getLicenseMenuAttributes()
    {
        return [
            'parent'     => Config::SLUG,
            'type'       => 'submenu',
            'name'       => 'License & Support',
            'capability' => Capabilities::MANAGE->value,
            'slug'       => Config::SLUG . '#/license',
        ];
    }
}
