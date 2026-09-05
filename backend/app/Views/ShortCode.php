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

if (!\defined('ABSPATH')) {
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

        $stateData = [
            'data' => $topicService->getAllTopics()
        ];

        // If we're on a single bit-connect post page, add topic details and comments for SSR
        if (is_singular(PostTypes::BIT_CONNECT->value) && get_the_ID()) {
            global $post;
            // Add topic details to state in the new format
            $stateData['topicDetails'] = [
                'topic' => $topicService->getTopicById($post->ID),
            ];
        }

        // Add post data and stages to state
        $stateData = array_merge(
            $stateData,
            [
                'data'   => (new PostController())->all()->getData(),
                'stages' => StageService::ordered(),
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
<svg width="56" height="56" viewBox="0 0 38 38" fill="none" xmlns="http://www.w3.org/2000/svg">
<rect width="38" height="38" rx="9.45449" fill="#3266EA"/>
<rect x="0.247669" y="0.247669" width="37.5047" height="37.5047" rx="9.20682" stroke="white" stroke-opacity="0.2" stroke-width="0.495339"/>
<path d="M28.7995 16.9998H24.658C23.8343 14.6698 21.6119 12.9994 18.9997 12.9994C18.2979 12.9994 17.625 13.1194 17 13.3412V9.20065C17.6461 9.06913 18.3152 9 18.9997 9C23.8382 9 27.8731 12.4349 28.7995 16.9998Z" fill="white"/>
<path d="M28.7993 21C27.8729 25.5648 23.837 28.9998 18.9995 28.9998C13.4765 28.9998 9 24.5223 9 18.9993C9 15.7276 10.5706 12.8235 12.9994 10.9995V18.9993C12.9994 22.3133 15.6865 24.9994 18.9995 24.9994C21.6117 24.9994 23.8341 23.3299 24.6578 21L28.7993 21Z" fill="white"/>
<path d="M21.0004 18.9992C21.0004 20.1042 20.1047 20.9999 18.9997 20.9999C17.8957 20.9999 17 20.1042 17 18.9992C17 17.8952 17.8957 16.9995 18.9997 16.9995C20.1047 16.9995 21.0004 17.8952 21.0004 18.9992Z" fill="white"/>
</svg>
SVG;
                // phpcs:enable Generic.Files.LineLength
            }

            $pageBody = <<<HTML
<div id="bit-connect-u-root" data-wp-interactive="bitConnectStore" data-wp-init="callbacks.postWatcher" data-bc-no-hydrate="1">
<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;gap:1.25rem;min-height:60vh;padding:2rem;">
<div style="display:flex;align-items:center;justify-content:center;">{$logoMarkup}</div>
<div style="display:flex;align-items:center;justify-content:center;">
<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:#3266EA;margin:0 4px;animation:bc-dot 1.5s infinite ease-in-out;"></span>
<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:#3266EA;margin:0 4px;animation:bc-dot 1.5s infinite ease-in-out;animation-delay:0.4s;"></span>
<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:#3266EA;margin:0 4px;animation:bc-dot 1.5s infinite ease-in-out;animation-delay:0.8s;"></span>
</div>
<style>@keyframes bc-dot{0%,100%{opacity:.4;transform:scale(.7)}50%{opacity:1;transform:scale(1.2)}}</style>
</div>
</div>
HTML;
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
