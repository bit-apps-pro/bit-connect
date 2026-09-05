<?php

namespace BitApps\BitConnect\Http\Controller;

// Prevent direct script access
if (!\defined('ABSPATH')) {
    exit;
}

use BitApps\BitConnect\Deps\BitApps\WPKit\Http\Request\Request;
use BitApps\BitConnect\SSR\Seo\SeoMeta;
use BitApps\BitConnect\SSR\SSRHandler;
use BitApps\BitConnect\Views\BaseView;

/**
 * Serves the portal shell for `/notifications`.
 *
 * Exists for the same reason UserProfilePageController does: neither router
 * knows a route it has not been told about, so without this the URL falls
 * through to WordPress and 404s before the app can boot. The SPA route existing
 * in AppRoutes.tsx is not enough — nothing ever gets far enough to consult it.
 *
 * Nothing is prepared server-side, and nothing can be: the list belongs to
 * whoever is logged in, so there is no shared HTML to render. The shell boots,
 * React takes over, and the client fetches the member's own rows. A signed-out
 * visitor gets a sign-in prompt from the page itself rather than a redirect,
 * because the notification they followed here is worth explaining.
 */
class NotificationsPageController
{
    private $ssrHandler;

    public function __construct($interactiveNamespace = 'bitConnectStore', $rootElementId = 'bit-connect-n-root', $rootElementAttributes = ['data-wp-init' => 'callbacks.postWatcher'])
    {
        $this->ssrHandler = new SSRHandler($interactiveNamespace, $rootElementId, $rootElementAttributes);
    }

    /**
     * Render the portal shell so the client router can take over.
     *
     * @return string
     */
    // phpcs:ignore VariableAnalysis.CodeAnalysis.VariableAnalysis.UnusedVariable -- the type hint is the route contract; there is nothing to read off it
    public function show(Request $request)
    {
        // Both steps are needed for the bundle to load: constructing BaseView
        // hooks wp_enqueue_scripts, and registerAssets() declares the script
        // modules that hook then enqueues. Without them the route renders the
        // loading shell and React never boots.
        $baseView = new BaseView();
        $baseView->registerAssets();

        SeoMeta::forNotifications();

        return $this->ssrHandler->generateView('/notifications', [], [], []);
    }
}
