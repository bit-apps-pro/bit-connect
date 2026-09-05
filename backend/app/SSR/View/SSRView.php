<?php

namespace BitApps\BitConnect\SSR\View;

use BitApps\BitConnect\Config;
use BitApps\BitConnect\Enum\GeneralSettings;
use BitApps\BitConnect\SSR\Helper\ContextHelper;
use BitApps\BitConnect\SSR\Helper\StateHelper;
use BitApps\BitConnect\SSR\Seo\SeoContent;
use WP_Term;

if (!\defined('ABSPATH')) {
    exit;
}

/**
 * Base SSR View class that provides a better interface for wp_interactivity state and context.
 */
class SSRView
{
    protected $stateHelper;

    protected $contextHelper;

    protected $routeParams = [];

    protected $viewData = [];

    protected $viewAsset;

    public function __construct(ViewAsset $viewAsset)
    {
        $this->viewAsset = $viewAsset;
        $this->stateHelper = new StateHelper($this->getInteractiveNamespace());
        $this->contextHelper = new ContextHelper();
    }

    /**
     * Set state data for wp_interactivity.
     *
     * @param array $state State data to set
     *
     * @return self
     */
    public function setState(array $state)
    {
        $this->stateHelper->setMultiple($state);

        return $this;
    }

    /**
     * Get current state data.
     *
     * @return array
     */
    public function getState()
    {
        return $this->stateHelper->getAll();
    }

    /**
     * Set context data for wp_interactivity.
     *
     * @param array $context Context data to set
     *
     * @return self
     */
    public function setContext(array $context)
    {
        $this->contextHelper->setMultiple($context);

        return $this;
    }

    /**
     * Get current context data.
     *
     * @return array
     */
    public function getContext()
    {
        return $this->contextHelper->getAll();
    }

    /**
     * Set route parameters.
     *
     * @param array $params Route parameters
     *
     * @return self
     */
    public function setRouteParams(array $params)
    {
        $this->routeParams = array_merge($this->routeParams, $params);

        return $this;
    }

    /**
     * Get route parameters.
     *
     * @return array
     */
    public function getRouteParams()
    {
        return $this->routeParams;
    }

    /**
     * Set view data.
     *
     * @param array $data View data
     *
     * @return self
     */
    public function setViewData(array $data)
    {
        $this->viewData = array_merge($this->viewData, $data);

        return $this;
    }

    /**
     * Get view data.
     *
     * @return array
     */
    public function getViewData()
    {
        return $this->viewData;
    }

    /**
     * Set template for the view.
     *
     * @param string $template Template name
     *
     * @return self
     */
    public function setTemplate($template)
    {
        $this->getViewAsset()->setTemplate($template);

        return $this;
    }

    /**
     * Get template for the view.
     *
     * @return string
     */
    public function getTemplate()
    {
        return $this->getViewAsset()->getTemplate();
    }

    /**
     * Get the state helper instance.
     *
     * @return StateHelper
     */
    public function getStateHelper()
    {
        return $this->stateHelper;
    }

    /**
     * Get the context helper instance.
     *
     * @return ContextHelper
     */
    public function getContextHelper()
    {
        return $this->contextHelper;
    }

    /**
     * Set the interactive namespace.
     *
     * @param string $namespace
     *
     * @return self
     */
    public function setInteractiveNamespace($namespace)
    {
        $this->getViewAsset()->setInteractiveNamespace($namespace);
        $this->stateHelper->setNamespace($namespace);

        return $this;
    }

    /**
     * Get the interactive namespace.
     *
     * @return string
     */
    public function getInteractiveNamespace()
    {
        return $this->getViewAsset()->getInteractiveNamespace();
    }

    /**
     * Set the root element ID.
     *
     * @param string $id
     *
     * @return self
     */
    public function setRootElementId($id)
    {
        $this->getViewAsset()->setRootElementId($id);

        return $this;
    }

    /**
     * Get the root element ID.
     *
     * @return string
     */
    public function getRootElementId()
    {
        return $this->getViewAsset()->getRootElementId();
    }

    /**
     * Set root element attributes.
     *
     * @param array $attributes
     *
     * @return self
     */
    public function setRootElementAttributes($attributes)
    {
        $this->getViewAsset()->setRootElementAttributes($attributes);

        return $this;
    }

    /**
     * Apply state and context to wp_interactivity API.
     */
    public function applyInteractivity()
    {
        $this->stateHelper->apply();
    }

    /**
     * Render the view with SSR support.
     *
     * @param string $route Route to render
     *
     * @return string
     */
    public function render($route = 'index.html') // phpcs:ignore VariableAnalysis.CodeAnalysis.VariableAnalysis.UnusedVariable
    {
        // Apply interactivity state
        $this->applyInteractivity();

        // Server content comes from this request's own data, not from the
        // build-time bundle in SSRData. That bundle rendered `routeList` alone
        // while the client mounts the full AppRoutes tree (ConfigProvider >
        // StyleProvider > AllPluginEssentials > Layout > page), so React could
        // never hydrate it — the structural mismatch made it re-render the whole
        // root anyway, and its markup held no real content to index.
        //
        // What is emitted instead is the route's actual topics, rendered as plain
        // semantic HTML by SeoContent, so crawlers that never run JavaScript still
        // read the content. The React app replaces it on mount, which is why the
        // root is marked no-hydrate.
        $seoContent = $this->getSeoContent();

        if ($seoContent === '') {
            $content = $this->getDefaultContent();
        } else {
            // Both states ship in the HTML; CSS picks one per client. Without
            // JavaScript (crawlers) the `bc-js` class is never added, the
            // spinner stays hidden and the content is visible. With JavaScript
            // (humans) the head script adds `bc-js` before first paint, so only
            // the spinner shows until React mounts and replaces the root.
            $content = '<div class="bc-ssr-loading">' . $this->getDefaultContent() . '</div>' . $seoContent;
        }

        if (!empty($this->getContext())) {
            $content = $this->contextHelper->applyToHtml($content);
        }

        $html = '<div ' . $this->getRootElementAttributesString() . ' data-bc-no-hydrate="1">'
            . $content
            . '</div>';

        return wp_interactivity_process_directives($html);
    }

    /**
     * Get the view asset instance.
     */
    public function getViewAsset(): ViewAsset
    {
        return $this->viewAsset;
    }

    /**
     * Register assets using the view asset instance.
     */
    public function registerAssets(): void
    {
        $this->viewAsset->registerAssets();
    }

    /**
     * Enqueue assets using the view asset instance.
     */
    public function enqueueAssets(): void
    {
        $this->viewAsset->enqueueAssets();
    }

    /**
     * Indexable HTML for the current route, or an empty string when this request
     * has no publicly renderable content (restricted portal, unknown route, or a
     * view that carried no data).
     */
    protected function getSeoContent(): string
    {
        if (!SeoContent::isEnabled()) {
            return '';
        }

        $viewData = $this->getViewData();

        if (\array_key_exists('topic', $viewData)) {
            return SeoContent::forTopic(\is_array($viewData['topic']) ? $viewData['topic'] : null);
        }

        // Checked before the plain list: an archive also carries `topics`, and
        // rendering it as the unfiltered list would drop the heading and
        // description that make the cluster page worth indexing.
        if (isset($viewData['term']) && $viewData['term'] instanceof WP_Term) {
            return SeoContent::forArchive($viewData['term'], (array) ($viewData['topics'] ?? []));
        }

        if (!empty($viewData['topics']) && \is_array($viewData['topics'])) {
            return SeoContent::forTopics(
                $viewData['topics'],
                (int) ($viewData['page'] ?? 1),
                (int) ($viewData['totalPages'] ?? 1)
            );
        }

        return '';
    }

    /**
     * Get root element attributes as a string.
     *
     * @return string
     */
    protected function getRootElementAttributesString()
    {
        $attrs = [];
        $attrs[] = 'id="' . esc_attr($this->getRootElementId()) . '"';
        $attrs[] = 'data-wp-interactive="' . esc_attr($this->getInteractiveNamespace()) . '"';

        foreach ($this->getViewAsset()->getRootElementAttributes() as $key => $value) {
            if (\is_bool($value)) {
                $attrs[] = $value ? $key : '';
            } else {
                $attrs[] = $key . '="' . esc_attr($value) . '"';
            }
        }

        return implode(' ', array_filter($attrs));
    }

    /**
     * Get default content when no SSR content exists.
     *
     * @return string
     */
    protected function getDefaultContent()
    {
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

        return <<<HTML
<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;gap:1.25rem;min-height:60vh;padding:2rem;">
<div style="display:flex;align-items:center;justify-content:center;">{$logoMarkup}</div>
<div style="display:flex;align-items:center;justify-content:center;">
<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:#3266EA;margin:0 4px;animation:bc-dot 1.5s infinite ease-in-out;"></span>
<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:#3266EA;margin:0 4px;animation:bc-dot 1.5s infinite ease-in-out;animation-delay:0.4s;"></span>
<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:#3266EA;margin:0 4px;animation:bc-dot 1.5s infinite ease-in-out;animation-delay:0.8s;"></span>
</div>
<style>@keyframes bc-dot{0%,100%{opacity:.4;transform:scale(.7)}50%{opacity:1;transform:scale(1.2)}}</style>
</div>
HTML;
    }

    /**
     * Get default template name.
     *
     * @return string
     */
    protected function getDefaultTemplate()
    {
        return 'index';
    }
}
