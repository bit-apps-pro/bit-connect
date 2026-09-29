<?php

namespace BitApps\BitConnect\Http\Controller;

// Prevent direct script access
if (!defined('ABSPATH')) {
    exit;
}


use BitApps\BitConnect\Deps\BitApps\WPKit\Http\Request\Request;
use BitApps\BitConnect\Services\DepartmentNaming;
use BitApps\BitConnect\Services\PortalTaxonomies;
use BitApps\BitConnect\SSR\Seo\SeoMeta;
use BitApps\BitConnect\SSR\SSRHandler;
use BitApps\BitConnect\Views\TopicsView;

class TopicsController
{
    private $ssrHandler;

    public function __construct($interactiveNamespace = 'bitConnectStore', $rootElementId = 'bit-connect-u-root', $rootElementAttributes = ['data-wp-init' => 'callbacks.postWatcher'])
    {
        $this->ssrHandler = new SSRHandler($interactiveNamespace, $rootElementId, $rootElementAttributes);
    }

    /**
     * Handle the root route and render the topics page.
     *
     * @param int|string $page list page, 1 unless a `/page/{n}` route matched
     *
     * @return string
     */
    public function index(Request $request, $page = 1) // phpcs:ignore VariableAnalysis.CodeAnalysis.VariableAnalysis.UnusedVariable
    {
        $page = max(1, (int) $page);

        // `?product=` on the list is the department's archive under a second
        // address — the picker wrote it before it navigated to the archive, so
        // shared links still carry it. Redirecting keeps one URL per department
        // collecting the links, where a canonical would only point at the root.
        // Read-only navigation, so there is no nonce to check.
        $product = isset($_GET['product']) ? sanitize_title(wp_unslash($_GET['product'])) : ''; // phpcs:ignore WordPress.Security.NonceVerification.Recommended
        $department = $product === '' ? null : PortalTaxonomies::resolve(PortalTaxonomies::slugFor(DepartmentNaming::KEY), $product);

        if ($department !== null) {
            $query = array_diff_key(wp_unslash($_GET), ['product' => true, 'page' => true]); // phpcs:ignore WordPress.Security.NonceVerification.Recommended

            wp_safe_redirect(add_query_arg(urlencode_deep($query), PortalTaxonomies::urlForTerm($department)), 301);

            exit;
        }

        // Prepare data for the topics view
        $topicsView = new TopicsView();
        $topicsView->prepareData($page);

        // Get state data to pass to the view
        $stateData = $topicsView->getState();

        // The view data has to be handed to generateView() as well: it builds its
        // own SSRView through the ViewManager, so anything left on $topicsView is
        // discarded. Without it the render has no content to emit for crawlers.
        $viewData = $topicsView->getViewData();

        // A page past the end is not a thin page, it is no page — answering 200
        // would turn every out-of-range number into an indexable empty listing.
        // A members-only portal's guest was given no topics to count, and gets
        // the sign-in prompt instead.
        if ($page > 1 && empty($viewData['topics']) && !TopicsView::isClosed()) {
            return (new NotFoundController())->index($request);
        }

        SeoMeta::forTopics($viewData['topics'] ?? [], $topicsView->getCurrentPage());

        // Generate the view using the SSR system
        $route = $page > 1 ? '/page/' . $page : '/';

        return $this->ssrHandler->generateView($route, $stateData, [], $viewData);
    }
}
