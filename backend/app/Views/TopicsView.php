<?php

namespace BitApps\BitConnect\Views;

use BitApps\BitConnect\Deps\BitApps\WPKit\Hooks\Hooks;
use BitApps\BitConnect\Enum\SeoSettings;
use BitApps\BitConnect\Http\Controller\PostController;
use BitApps\BitConnect\Services\StageService;
use BitApps\BitConnect\Services\TopicService;
use BitApps\BitConnect\SSR\View\SSRView;
use BitApps\BitConnect\SSR\View\ViewAsset;
use WP_Term;

if (!defined('ABSPATH')) {
    exit;
}

/**
 * Topics view class that extends the base SSRView.
 */
class TopicsView extends SSRView
{
    public BaseView $baseView;

    /**
     * Page of the list route this view rendered, and how many there are.
     *
     * Read by the controller to build the crawler's prev/next trail. Pages after
     * the first exist only as that trail — see SeoMeta::forTopics().
     */
    private int $currentPage = 1;

    private int $totalPages = 1;

    private TopicService $topicService;

    public function __construct()
    {
        $viewAsset = new ViewAsset(
            'bitConnectStore',
            'bit-connect-u-root',
            ['data-wp-init' => 'callbacks.postWatcher']
        );
        parent::__construct($viewAsset);
        $this->topicService = new TopicService();
        $this->baseView = new BaseView();
    }

    /**
     * Prepare data for the topics view.
     *
     * @param mixed $page
     *
     * @return self
     */
    public function prepareData($page = 1)
    {
        $limit = (int) Hooks::applyFilter('bit_connect_ssr_topic_limit', SeoSettings::ssrTopicLimit());
        $page = max(1, (int) $page);

        $topicsData = $this->topicService->getAllTopics(
            $limit > 0 ? ['numberposts' => $limit, 'paged' => $page] : []
        );

        $total = $this->topicService->getLastQueryTotal();
        $this->totalPages = $limit > 0 ? max(1, (int) ceil($total / $limit)) : 1;
        $this->currentPage = $page;

        // Add asset registration callback
        // $this->getViewAsset()->addRegisterCallback(function () {
        //     $this->baseView->registerAssets();
        // });
        $this->baseView->registerAssets();

        // Add asset enqueuing callback
        $this->getViewAsset()->addEnqueueCallback(
            function () {
                if (!wp_script_is('media-upload')) {
                    wp_enqueue_media();
                }
            }
        );

        // Get stages data, in the order an admin arranged them
        $stages = StageService::ordered();

        // Set state data
        $this->setState(
            [
                'data'   => $topicsData,
                'stages' => $stages,
            ]
        );

        // Set view data
        $this->setViewData(
            [
                'topics'     => $topicsData,
                'stages'     => $stages,
                'page'       => $this->currentPage,
                'totalPages' => $this->totalPages,
            ]
        );

        return $this;
    }

    public function getCurrentPage(): int
    {
        return $this->currentPage;
    }

    public function getTotalPages(): int
    {
        return $this->totalPages;
    }

    /**
     * Prepare data for a term archive: the topics carrying one term.
     *
     * Bounded by the same limit as the unfiltered list — an archive is a list
     * like any other, and the sitemap is what makes the rest discoverable.
     *
     * @return self
     */
    public function prepareArchiveData(WP_Term $term)
    {
        $this->baseView->registerAssets();

        $limit = (int) Hooks::applyFilter('bit_connect_ssr_topic_limit', SeoSettings::ssrTopicLimit());

        $topicsData = $this->topicService->getAllTopics(
            [
                'numberposts' => $limit > 0 ? $limit : -1,
                // phpcs:ignore WordPress.DB.SlowDBQuery.slow_db_query_tax_query -- Topics are filtered by taxonomy by design; there is no meta equivalent.
                'tax_query' => [
                    [
                        'taxonomy' => $term->taxonomy,
                        'field'    => 'term_id',
                        'terms'    => [$term->term_id],
                    ],
                ],
            ]
        );

        $stages = StageService::ordered();

        $this->setState(
            [
                'data'   => $topicsData,
                'stages' => $stages,
            ]
        );

        $this->setViewData(
            [
                'topics' => $topicsData,
                'stages' => $stages,
                'term'   => $term,
            ]
        );

        return $this;
    }

    /**
     * Prepare data for a single topic view.
     *
     * @param string $topicSlug Topic ID
     *
     * @return self
     */
    public function prepareTopicDetailsData($topicSlug)
    {
        $this->baseView->registerAssets();

        $topicData = $this->topicService->getTopicBySlug($topicSlug);

        $this->setState(
            [
                'topicDetails' => [
                    'topic' => $topicData,
                ],
            ]
        );

        $this->setViewData(
            [
                'topic' => $topicData,
            ]
        );

        return $this;
    }

    /**
     * Prepare data for the post view.
     *
     * @return self
     */
    public function preparePostData()
    {
        $postController = new PostController();
        $postData = $postController->all()->getData();

        // Set state data
        $this->setState(
            [
                'data' => $postData,
            ]
        );

        // Set view data
        $this->setViewData(
            [
                'posts' => $postData,
            ]
        );

        return $this;
    }
}
