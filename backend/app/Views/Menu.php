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
        // The order of the in-app sidebar: daily work, then how topics are
        // sorted, then settings, then the plugin's own Support screen.
        return [
            'Home'        => self::getHomeMenuAttributes($body),
            'Dashboard'   => self::getDashboardMenuAttributes(),
            'Topics'      => self::getTopicsMenuAttributes(),
            'Reports'     => self::getReportsMenuAttributes(),
            'Activity'    => self::getActivityMenuAttributes(),
            'Manager'     => self::getManagerMenuAttributes(),
            'Topic Types' => self::getTopicTypesMenuAttributes(),
            'Stages'      => self::getStagesMenuAttributes(),
            'Status'      => self::getStatusMenuAttributes(),
            'Tags'        => self::getTagsMenuAttributes(),
            'Settings'    => self::getSettingsMenuAttributes(),
            'Support'     => self::getSupportMenuAttributes(),
        ];
    }

    private static function getHomeMenuAttributes(Body $body)
    {
        // phpcs:ignore Generic.Files.LineLength.MaxExceeded
        $icon = 'data:image/svg+xml;base64,' . base64_encode('<svg width="20" height="20" viewBox="9 9 20 20" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M28.7995 16.9998H24.658C23.8343 14.6698 21.6119 12.9994 18.9997 12.9994C18.2979 12.9994 17.625 13.1194 17 13.3412V9.20065C17.6461 9.06913 18.3152 9 18.9997 9C23.8382 9 27.8731 12.4349 28.7995 16.9998Z" fill="white"/><path d="M28.7993 21.0004C27.8729 25.5653 23.837 29.0003 18.9995 29.0003C13.4765 29.0003 9 24.5227 9 18.9998C9 15.7281 10.5706 12.824 12.9994 11V18.9998C12.9994 22.3138 15.6865 24.9999 18.9995 24.9999C21.6117 24.9999 23.8341 23.3304 24.6578 21.0005L28.7993 21.0004Z" fill="white"/><path d="M21.0004 18.9997C21.0004 20.1047 20.1047 21.0004 18.9997 21.0004C17.8957 21.0004 17 20.1047 17 18.9997C17 17.8957 17.8957 17 18.9997 17C20.1047 17 21.0004 17.8957 21.0004 18.9997Z" fill="white"/></svg>');

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
            'name'       => 'Statuses',
            'capability' => Capabilities::MANAGE->value,
            'slug'       => Config::SLUG . '#/status',
        ];
    }

    /**
     * Every topic in one table, to set statuses and stages, lock, hide or
     * delete — several at once. bit_connect_forum_moderate: that is the work a
     * moderator does, and defining the statuses and stages stays with Manage.
     */
    private static function getTopicsMenuAttributes()
    {
        return [
            'parent'     => Config::SLUG,
            'type'       => 'submenu',
            'name'       => 'Topics',
            'capability' => Capabilities::MODERATE->value,
            'slug'       => Config::SLUG . '#/topics',
        ];
    }

    /**
     * A screen under this menu that answers to bit_connect_forum_moderate.
     *
     * Most of the rest is settings and belongs to bit_connect_forum_manage; reviewing
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
            'name'       => 'Members',
            'capability' => Capabilities::MANAGE->value,
            'slug'       => Config::SLUG . '#/manager',
        ];
    }

    /**
     * Every setting the forum has, one tab per subject: the portal, sign-in,
     * topics, moderation, limits, notifications, SEO and data.
     */
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
