<?php

namespace BitApps\BitConnect\Http\Controller;

// Prevent direct script access
if (!defined('ABSPATH')) {
    exit;
}


use BitApps\BitConnect\Config;
use BitApps\BitConnect\Deps\BitApps\WPKit\Http\Request\Request;
use BitApps\BitConnect\Services\PortalPreload;
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
     * Also answers `/{slug}/comment/{commentId}`, a link to one reply. The page
     * is the topic's own either way: the portal scrolls to the reply once the
     * thread loads, and says so there when it is gone. Nothing about the reply
     * is decided here, so a deleted one still gets its topic rather than a 404,
     * and the canonical URL stays the topic's.
     *
     * @param string      $slug      Topic slug
     * @param null|string $commentId the reply a comment link names; the portal
     *                               resolves it, so it is unused here
     *
     * @return string
     */
    public function show(Request $request, $slug, $commentId = null)
    {
        // The single-segment route also carries the pages plugins draw — see
        // ExtensionPoints::portalPages(). Read here, per request, because the
        // route table is built before plugins register their pages.
        if ($commentId === null && \is_string($slug) && PortalPageController::isPage($slug)) {
            return (new PortalPageController())->show($request, $slug);
        }

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
        //
        // Not for a visitor a members-only portal turns away: they were given
        // no topic to look for, and get the portal's sign-in prompt whether or
        // not the slug exists — which is also what keeps it from saying so.
        if (empty($viewData['topic']) && !TopicsView::isClosed()) {
            return (new NotFoundController())->index($request);
        }

        SeoMeta::forTopic($viewData['topic'] ?? null);

        // The topic and its first page of comments are what the page asks for
        // first, one after the other — see PortalPreload. The paths are the
        // app's own: fetchPostByNameApi(), then fetchCommentsApi() with its
        // defaults.
        if (\is_string($slug) && $slug !== '') {
            PortalPreload::add('/' . Config::SLUG . '/v1/topics?name=' . rawurlencode($slug));
        }

        // The topic page's own code, fetched beside the main bundle.
        PortalPreload::chunk('post-details');

        $topicId = (int) ($viewData['topic']['ID'] ?? 0);
        if ($topicId > 0) {
            PortalPreload::add('/' . Config::SLUG . '/v1/posts/' . $topicId . '/comments?page=1&per_page=10&sort=newest');
        }

        // Generate the view using the SSR system
        $route = '/' . $slug;

        return $this->ssrHandler->generateView($route, $stateData, [], $viewData);
    }
}
