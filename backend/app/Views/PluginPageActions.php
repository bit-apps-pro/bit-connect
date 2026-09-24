<?php

namespace BitApps\BitConnect\Views;

use BitApps\BitConnect\Config;

if (!defined('ABSPATH')) {
    exit;
}


class PluginPageActions
{
    /**
     * Provides links for plugin pages. Those links will bi displayed in
     * all plugin pages under the plugin name.
     *
     * @return array
     */
    public function getActionLinks()
    {
        return [
            'settings' => [
                'title' => __('Settings', 'bit-connect'),
                'url'   => Config::get('ADMIN_URL') . 'admin.php?page=' . Config::SLUG . '#/settings',
            ],
            // Support and the changelog.
            'support' => [
                'title' => __('Support', 'bit-connect'),
                'url'   => Config::get('ADMIN_URL') . 'admin.php?page=' . Config::SLUG . '#/support',
            ],
        ];
    }

    /**
     *  Render Plugin action links.
     *
     * @param array $links Array of links
     *
     * @return array
     */
    public function renderActionLinks($links)
    {
        $linksToAdd = $this->getActionLinks();

        foreach ($linksToAdd as $link) {
            $links[] = \sprintf('<a href="%s">%s</a>', esc_url($link['url']), esc_html($link['title']));
        }

        return $links;
    }
}
