<?php

namespace BitApps\BitConnect\Http\Controller;

// Prevent direct script access
if (!defined('ABSPATH')) {
    exit;
}

use BitApps\BitConnect\Deps\BitApps\WPKit\Http\Request\Request;
use BitApps\BitConnect\Services\PortalTaxonomies;
use BitApps\BitConnect\SSR\Seo\SeoMeta;
use BitApps\BitConnect\SSR\SSRHandler;
use BitApps\BitConnect\Views\TopicsView;

/**
 * Serves a term archive: every topic carrying one stage, tag, department, ….
 *
 * These are the portal's topic clusters — the page that can rank for a subject
 * rather than for one question about it, and the hub that links deep topics
 * together so they are reachable in fewer hops than the sitemap alone allows.
 */
class TopicArchiveController
{
    private $ssrHandler;

    public function __construct($interactiveNamespace = 'bitConnectStore', $rootElementId = 'bit-connect-u-root', $rootElementAttributes = ['data-wp-init' => 'callbacks.postWatcher'])
    {
        $this->ssrHandler = new SSRHandler($interactiveNamespace, $rootElementId, $rootElementAttributes);
    }

    /**
     * Render the archive for `/{segment}/{termSlug}`.
     *
     * @param string $segment  archive segment, e.g. `stage`
     * @param string $termSlug term slug within that taxonomy
     *
     * @return string
     */
    public function show(Request $request, $segment, $termSlug)
    {
        $term = PortalTaxonomies::resolve((string) $segment, (string) $termSlug);

        // An unknown term is a genuine 404, not an empty archive answering 200 —
        // otherwise every mistyped term URL becomes an indexable blank page.
        if ($term === null) {
            return (new NotFoundController())->index($request);
        }

        $topicsView = new TopicsView();
        $topicsView->prepareArchiveData($term);

        $stateData = $topicsView->getState();
        $viewData = $topicsView->getViewData();

        SeoMeta::forArchive($term, $viewData['topics'] ?? []);

        return $this->ssrHandler->generateView(
            '/' . $segment . '/' . $termSlug,
            $stateData,
            [],
            $viewData
        );
    }
}
