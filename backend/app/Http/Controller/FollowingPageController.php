<?php

namespace BitApps\BitConnect\Http\Controller;

// Prevent direct script access
if (!defined('ABSPATH')) {
    exit;
}

use BitApps\BitConnect\Deps\BitApps\WPKit\Http\Request\Request;
use BitApps\BitConnect\SSR\Seo\SeoMeta;
use BitApps\BitConnect\SSR\SSRHandler;
use BitApps\BitConnect\Views\BaseView;

/**
 * Serves the portal shell for `/following`.
 *
 * Exists for the reason NotificationsPageController does: without it the URL
 * falls through to WordPress and 404s before the app can boot. The list belongs
 * to whoever is logged in, so nothing is prepared here; the client fetches it.
 */
class FollowingPageController
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
        $baseView = new BaseView();
        $baseView->registerAssets();

        SeoMeta::forFollowing();

        return $this->ssrHandler->generateView('/following', [], [], []);
    }
}
