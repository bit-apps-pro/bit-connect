<?php

namespace BitApps\BitConnect\Http\Controller;

// Prevent direct script access
if (!defined('ABSPATH')) {
    exit;
}

use BitApps\BitConnect\Deps\BitApps\WPKit\Http\Request\Request;
use BitApps\BitConnect\Services\ExtensionPoints;
use BitApps\BitConnect\SSR\Seo\SeoMeta;
use BitApps\BitConnect\SSR\SSRHandler;
use BitApps\BitConnect\Views\BaseView;

/**
 * Serves the portal shell at a path a plugin draws — see
 * ExtensionPoints::portalPages().
 *
 * The same shell the roadmap and notifications get: nothing is prepared here,
 * the app boots and the plugin's client route draws the page from its own
 * requests.
 */
class PortalPageController
{
    private $ssrHandler;

    public function __construct($interactiveNamespace = 'bitConnectStore', $rootElementId = 'bit-connect-n-root', $rootElementAttributes = ['data-wp-init' => 'callbacks.postWatcher'])
    {
        $this->ssrHandler = new SSRHandler($interactiveNamespace, $rootElementId, $rootElementAttributes);
    }

    public static function isPage(string $path): bool
    {
        return isset(ExtensionPoints::portalPages()[$path]);
    }

    /**
     * @return string
     */
    // phpcs:ignore VariableAnalysis.CodeAnalysis.VariableAnalysis.UnusedVariable -- the type hint is the route contract; there is nothing to read off it
    public function show(Request $request, string $path)
    {
        // Both steps are needed for the bundle to load — see
        // NotificationsPageController::show().
        $baseView = new BaseView();
        $baseView->registerAssets();

        SeoMeta::forPortalPage(ExtensionPoints::portalPages()[$path] ?? $path);

        return $this->ssrHandler->generateView('/' . $path, [], [], []);
    }
}
