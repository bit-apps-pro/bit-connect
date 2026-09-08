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
            // This pointed at '#/license' for a long time while no such route
            // existed, so it landed every visitor on Error404. The route exists
            // now — it is '#/support', because that is what the screen is in
            // this plugin: support, the changelog and what the add-on adds, with
            // no licence to manage. '#/license' still redirects there, for links
            // released before the rename.
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
            $links[] = '<a href="' . $link['url'] . '">' . $link['title'] . '</a>';
        }

        return $links;
    }
}
