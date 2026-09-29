<?php

namespace BitApps\BitConnect\SSR\View;

use BitApps\BitConnect\Config;
use BitApps\BitConnect\Enum\GeneralSettings;
use BitApps\BitConnect\SSR\Helper\ContextHelper;
use BitApps\BitConnect\SSR\Helper\StateHelper;
use BitApps\BitConnect\SSR\Seo\SeoContent;
use WP_Term;

if (!defined('ABSPATH')) {
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

        // Server content comes from this request's own data. A build-time
        // prerender of the React app used to be emitted here too; it rendered
        // `routeList` alone while the client mounts the full AppRoutes tree
        // (ConfigProvider > StyleProvider > AllPluginEssentials > Layout >
        // page), so React could never hydrate it — the structural mismatch made
        // it re-render the whole root anyway, and its markup held no real
        // content to index. That step has been removed rather than left
        // generating output nothing reads.
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
<svg width="56" height="56" viewBox="0 0 532 532" fill="none" xmlns="http://www.w3.org/2000/svg">
<rect width="531.766" height="531.766" rx="132.305" fill="#3266EA"/>
<rect x="3.46585" y="3.46585" width="524.834" height="524.834" rx="128.839" stroke="white" stroke-opacity="0.2" stroke-width="6.93169"/>
<path d="M284.966 348.289H372.14C379.935 348.289 384.752 356.747 380.816 363.476C348.981 417.917 295.95 450.139 242.507 441.034C196.885 433.273 161.509 397.183 144.651 348.289C133.928 317.175 130.689 280.875 137.083 243.367C140.691 222.163 147.076 202.344 155.635 184.454C186.002 120.951 243.741 81.7986 301.991 91.7084C343.107 98.7065 375.891 128.696 394.309 170.349C397.246 176.986 392.337 184.454 385.079 184.454H319.31C314.871 184.454 310.995 181.542 309.677 177.305C301.412 150.823 285.914 132.774 265.364 129.661C238.597 125.6 209.38 147.567 188.36 184.454C177.401 203.678 168.666 226.963 163.657 252.715C156.474 289.694 158.547 323.376 167.517 348.289C177.334 375.568 195.417 392.333 218.643 391.393C239.294 390.554 259.902 375.685 276.835 352.476C278.74 349.866 281.752 348.297 284.983 348.297L284.966 348.289Z" fill="white"/>
<path d="M350.024 327.688C370.41 327.688 386.936 311.162 386.936 290.776C386.936 270.39 370.41 253.864 350.024 253.864C329.638 253.864 313.112 270.39 313.112 290.776C313.112 311.162 329.638 327.688 350.024 327.688Z" fill="white"/>
</svg>
SVG;
            // phpcs:enable Generic.Files.LineLength
        }

        return strtr(
            <<<'HTML'
<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;gap:1.25rem;min-height:60vh;padding:2rem;">
<div style="display:flex;align-items:center;justify-content:center;">{{logo}}</div>
<div style="display:flex;align-items:center;justify-content:center;">
<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:#3266EA;margin:0 4px;animation:bc-dot 1.5s infinite ease-in-out;"></span>
<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:#3266EA;margin:0 4px;animation:bc-dot 1.5s infinite ease-in-out;animation-delay:0.4s;"></span>
<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:#3266EA;margin:0 4px;animation:bc-dot 1.5s infinite ease-in-out;animation-delay:0.8s;"></span>
</div>
</div>
HTML,
            ['{{logo}}' => $logoMarkup]
        );
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
