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
 * Renders "not found" inside the portal, with a real 404 status.
 *
 * Both halves matter, and they are usually got wrong in opposite directions. A
 * portal that renders its own shell but answers 200 is a soft 404: search
 * engines index an unbounded set of junk URLs under the community's name. A
 * portal that answers 404 but hands the visitor the theme's error page throws
 * them out of the community mid-journey, with no route back into it.
 */
class NotFoundController
{
    private $ssrHandler;

    public function __construct($interactiveNamespace = 'bitConnectStore', $rootElementId = 'bit-connect-u-root', $rootElementAttributes = ['data-wp-init' => 'callbacks.postWatcher'])
    {
        $this->ssrHandler = new SSRHandler($interactiveNamespace, $rootElementId, $rootElementAttributes);
    }

    /**
     * Handle the 404 route and render the not found page.
     *
     * @return string
     */
    public function index(Request $request) // phpcs:ignore VariableAnalysis.CodeAnalysis.VariableAnalysis.UnusedVariable
    {
        self::markResponseNotFound();

        // Constructing BaseView hooks wp_enqueue_scripts and registerAssets()
        // declares the script modules that hook enqueues. Without both, the
        // route renders the shell and React never boots — the visitor is left
        // on the loading placeholder instead of the 404 screen.
        $baseView = new BaseView();
        $baseView->registerAssets();

        $stateData = [
            'error' => [
                'code'    => 404,
                'message' => 'Page not found'
            ]
        ];

        // Generate the view using the SSR system
        $route = '*';

        return $this->ssrHandler->generateView($route, $stateData);
    }

    /**
     * Send a 404 for a request the portal is nonetheless going to render.
     *
     * The main query is deliberately left alone: flipping it to is_404() would
     * hand the request to the theme's error template and lose the portal.
     */
    public static function markResponseNotFound(): void
    {
        // Both no-op safely once headers are out — WordPress guards them itself,
        // so there is nothing useful to add here.
        status_header(404);
        nocache_headers();

        // The status alone is authoritative for search engines; the head covers
        // the crawlers that read markup more eagerly than headers. Described as
        // a route like any other, so SeoMeta prints the noindex and drops core's
        // canonical — which would announce this missing URL as the portal's
        // landing page — and the site's SEO plugin is stood down rather than
        // printing the portal page's own `index` tags beside it.
        SeoMeta::forNotFound();
    }
}
