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
 * Serves the portal shell for `/roadmap`, the stages laid out as a board.
 *
 * Exists for the reason NotificationsPageController does: neither router knows
 * a route it has not been told about, so without this the URL falls through to
 * WordPress and 404s before the app can boot. The board is drawn client-side
 * from the same topics endpoint the listing reads.
 */
class RoadmapPageController
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
        // Both steps are needed for the bundle to load — see
        // NotificationsPageController::show().
        $baseView = new BaseView();
        $baseView->registerAssets();

        SeoMeta::forRoadmap();

        return $this->ssrHandler->generateView('/roadmap', [], [], []);
    }
}
