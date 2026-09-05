<?php

namespace BitApps\BitConnect\Http\Controller;

// Prevent direct script access
if (!defined('ABSPATH')) {
    exit;
}


use BitApps\BitConnect\Deps\BitApps\WPKit\Http\Request\Request;
use BitApps\BitConnect\SSR\Seo\SeoMeta;
use BitApps\BitConnect\SSR\SSRHandler;
use BitApps\BitConnect\Views\TopicsView;

class TopicDetailsController
{
    private $ssrHandler;

    public function __construct($interactiveNamespace = 'bitConnectStore', $rootElementId = 'bit-connect-u-root', $rootElementAttributes = ['data-wp-init' => 'callbacks.postWatcher'])
    {
        $this->ssrHandler = new SSRHandler($interactiveNamespace, $rootElementId, $rootElementAttributes);
    }

    /**
     * Handle the topic details route and render the topic details page.
     *
     * @param string $slug Topic slug
     *
     * @return string
     */
    public function show(Request $request, $slug)
    {
        // Prepare data for the topic details view
        $topicsView = new TopicsView();
        $topicsView->prepareTopicDetailsData($slug);

        // Get state data to pass to the view
        $stateData = $topicsView->getState();

        // generateView() builds its own SSRView via the ViewManager, so the data
        // prepared above only reaches the render if it is passed along explicitly.
        $viewData = $topicsView->getViewData();

        // The single-segment route is a catch-all: any slug that is not a topic
        // lands here. Rendering the shell anyway and answering 200 would make
        // every typo and every deleted topic an indexable page.
        if (empty($viewData['topic'])) {
            return (new NotFoundController())->index($request);
        }

        SeoMeta::forTopic($viewData['topic'] ?? null);

        // Generate the view using the SSR system
        $route = '/' . $slug;

        return $this->ssrHandler->generateView($route, $stateData, [], $viewData);
    }
}
