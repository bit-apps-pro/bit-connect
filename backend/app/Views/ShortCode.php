<?php

namespace BitApps\BitConnect\Views;

use BitApps\BitConnect\Config;
use BitApps\BitConnect\Deps\BitApps\WPKit\Http\Router\StaticRouter;
use BitApps\BitConnect\Enum\GeneralSettings;
use BitApps\BitConnect\Enum\PostTypes;
use BitApps\BitConnect\Http\Controller\PostController;
use BitApps\BitConnect\Services\PortalLocation;
use BitApps\BitConnect\Services\RootRouter;
use BitApps\BitConnect\Services\StageService;
use BitApps\BitConnect\Services\TopicService;
use BitApps\BitConnect\SSR\SSRHandler;
use WP_Post;

if (!defined('ABSPATH')) {
    exit;
}


class ShortCode
{
    private SSRHandler $ssrHandler;

    private BaseView $baseView;

    public function __construct()
    {
        $this->ssrHandler = new SSRHandler();

        // Config payload and asset enqueueing live in BaseView — constructing
        // it registers those hooks once (it guards against re-registration).
        // ShortCode used to carry its own copies of createConfigVariable() and
        // enqueueAssets(); the copies drifted (wpMediaSettings existed only in
        // BaseView's) and on portal routes both ran, printing the config twice.
        $this->baseView = new BaseView();
    }

    public function render(mixed $attributes)
    {
        // The portal route is already server-rendered by the active router, which
        // appends its output to the_content. When the portal page also contains the
        // shortcode (the default page content), rendering here would put a second
        // app root on the page — the client only hydrates the first one, so the
        // extra copy stays as dead markup. Let the route-aware SSR output win.
        if (self::isServerRendered()) {
            return '';
        }

        // A hand-made shortcode page becomes the portal when none is configured,
        // so its deep links get rewrites instead of 404ing on reload.
        $current = get_post();
        if (is_singular('page') && $current instanceof WP_Post) {
            PortalLocation::adoptPage($current);
        }

        $page = isset($attributes['page']) ? $attributes['page'] : '';

        // Use the new SSR View system
        $viewManager = $this->ssrHandler->getViewManager(); // phpcs:ignore VariableAnalysis.CodeAnalysis.VariableAnalysis.UnusedVariable
        $topicService = new TopicService();

        // A members-only portal's guest gets no topics in the hydration state —
        // see TopicsView::isClosed().
        $isClosed = TopicsView::isClosed();

        $stateData = [
            'data' => $isClosed ? [] : $topicService->getAllTopics()
        ];

        // If we're on a single bit-connect post page, add topic details and comments for SSR
        if (!$isClosed && is_singular(PostTypes::BIT_CONNECT->value) && get_the_ID()) {
            global $post;
            // Add topic details to state in the new format
            $stateData['topicDetails'] = [
                'topic' => $topicService->getReadableTopicById($post->ID),
            ];
        }

        // Add post data and stages to state
        $stateData = array_merge(
            $stateData,
            [
                'data'   => (new PostController())->all()->getData(),
                'stages' => $isClosed ? [] : StageService::ordered(),
            ]
        );

        if (\is_string($page)) {
            $this->baseView->registerAssets();

            // Generate view using the new system
            $pageBody = $this->ssrHandler->generateView($page, $stateData);
        } else {
            // Fallback content
            $generalSettings = Config::getOption(GeneralSettings::OPTION_NAME->value, []);
            $logoLight = $generalSettings['logoLight'] ?? '';
            $communityTitle = $generalSettings['communityTitle'] ?? '';

            if ($logoLight !== '') {
                $logoMarkup = '<img src="' . esc_url($logoLight) . '" alt="' . esc_attr($communityTitle) . '" style="height:56px;width:auto;display:block;" />';
            } else {
                // phpcs:disable Generic.Files.LineLength -- SVG path data cannot be wrapped
                $logoMarkup = <<<'SVG'
<svg width="56" height="56" viewBox="0 0 532 532" fill="none" xmlns="http://www.w3.org/2000/svg">
<rect width="531.766" height="531.766" rx="132.305" fill="#3266EA"/>
<rect x="3.46585" y="3.46585" width="524.834" height="524.834" rx="128.839" stroke="white" stroke-opacity="0.2" stroke-width="6.93169"/>
<path d="M284.966 348.289H372.14C379.935 348.289 384.752 356.747 380.816 363.476C348.981 417.917 295.95 450.139 242.507 441.034C196.885 433.273 161.509 397.183 144.651 348.289C133.928 317.175 130.689 280.875 137.083 243.367C140.691 222.163 147.076 202.344 155.635 184.454C186.002 120.951 243.741 81.7986 301.991 91.7084C343.107 98.7065 375.891 128.696 394.309 170.349C397.246 176.986 392.337 184.454 385.079 184.454H319.31C314.871 184.454 310.995 181.542 309.677 177.305C301.412 150.823 285.914 132.774 265.364 129.661C238.597 125.6 209.38 147.567 188.36 184.454C177.401 203.678 168.666 226.963 163.657 252.715C156.474 289.694 158.547 323.376 167.517 348.289C177.334 375.568 195.417 392.333 218.643 391.393C239.294 390.554 259.902 375.685 276.835 352.476C278.74 349.866 281.752 348.297 284.983 348.297L284.966 348.289Z" fill="white"/>
<path d="M350.024 327.688C370.41 327.688 386.936 311.162 386.936 290.776C386.936 270.39 370.41 253.864 350.024 253.864C329.638 253.864 313.112 270.39 313.112 290.776C313.112 311.162 329.638 327.688 350.024 327.688Z" fill="white"/>
</svg>
SVG;
                // phpcs:enable Generic.Files.LineLength
            }

            $pageBody = strtr(
                <<<'HTML'
<div id="bit-connect-u-root" data-wp-interactive="bitConnectStore" data-wp-init="callbacks.postWatcher" data-bc-no-hydrate="1">
<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;gap:1.25rem;min-height:60vh;padding:2rem;">
<div style="display:flex;align-items:center;justify-content:center;">{{logo}}</div>
<div style="display:flex;align-items:center;justify-content:center;">
<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:#3266EA;margin:0 4px;animation:bc-dot 1.5s infinite ease-in-out;"></span>
<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:#3266EA;margin:0 4px;animation:bc-dot 1.5s infinite ease-in-out;animation-delay:0.4s;"></span>
<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:#3266EA;margin:0 4px;animation:bc-dot 1.5s infinite ease-in-out;animation-delay:0.8s;"></span>
</div>
</div>
</div>
HTML,
                ['{{logo}}' => $logoMarkup]
            );
            wp_interactivity_state('bitConnectStore', $stateData);
            $pageBody = wp_interactivity_process_directives($pageBody);
        }

        return $pageBody;
    }

    /**
     * Whether a portal route has taken over the current request.
     *
     * Slug mode: StaticRouter only registers its `the_content` filter once a
     * route actually matches, so its presence is the signal. Root mode routes on
     * the 404 rather than on rewrites, so RootRouter reports the takeover
     * directly.
     */
    public static function isServerRendered(): bool
    {
        if (RootRouter::hasClaimed()) {
            return true;
        }

        global $wp_filter;

        if (!isset($wp_filter['the_content'])) {
            return false;
        }

        foreach ($wp_filter['the_content']->callbacks as $callbacks) {
            foreach ($callbacks as $callback) {
                $function = $callback['function'] ?? null;

                if (
                    \is_array($function)
                    && isset($function[0], $function[1])
                    && $function[0] instanceof StaticRouter
                    && $function[1] === 'renderContent'
                ) {
                    return true;
                }
            }
        }

        return false;
    }
}
