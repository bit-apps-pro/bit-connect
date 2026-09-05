<?php

namespace BitApps\BitConnect\Http\Controller;

// Prevent direct script access
if (!\defined('ABSPATH')) {
    exit;
}


use BitApps\BitConnect\Deps\BitApps\WPKit\Http\Request\Request;
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
        if ($page > 1 && empty($viewData['topics'])) {
            return (new NotFoundController())->index($request);
        }

        SeoMeta::forTopics($viewData['topics'] ?? [], $topicsView->getCurrentPage());

        // Generate the view using the SSR system
        $route = $page > 1 ? '/page/' . $page : '/';

        return $this->ssrHandler->generateView($route, $stateData, [], $viewData);
    }
}
