<?php

namespace BitApps\BitConnect\SSR\View;

use BitApps\BitConnect\SSR\SSRData;

if (!defined('ABSPATH')) {
    exit;
}

/**
 * View Manager class to handle route-based view generation with wp_interactivity support.
 */
class ViewManager
{
    private static $instance;

    private $views = [];

    private $currentRoute = '';

    private $routeParams = [];

    private $defaultViewClass;

    private $defaultInteractiveNamespace;

    private $defaultRootElementId;

    private $defaultRootElementAttributes;

    public function __construct(
        $defaultViewClass = SSRView::class,
        $defaultInteractiveNamespace = 'wpStore',
        $defaultRootElementId = 'wp-interactive-root',
        $defaultRootElementAttributes = []
    ) {
        $this->defaultViewClass = $defaultViewClass;
        $this->defaultInteractiveNamespace = $defaultInteractiveNamespace;
        $this->defaultRootElementId = $defaultRootElementId;
        $this->defaultRootElementAttributes = $defaultRootElementAttributes;
    }

    public static function getInstance(
        $defaultViewClass = null,
        $defaultInteractiveNamespace = null,
        $defaultRootElementId = null,
        $defaultRootElementAttributes = []
    ) {
        if (self::$instance === null) {
            self::$instance = new self(
                $defaultViewClass ?: SSRView::class,
                $defaultInteractiveNamespace ?: 'wpStore',
                $defaultRootElementId ?: 'wp-interactive-root',
                $defaultRootElementAttributes
            );
        }

        return self::$instance;
    }

    /**
     * Register a view for a specific route.
     *
     * @param string $route Route pattern
     * @param callable|string $view View callback or class name
     * @param array $options Additional options
     *
     * @return self
     */
    public function registerView($route, $view, $options = [])
    {
        $this->views[$route] = [
            'view'    => $view,
            'options' => $options
        ];

        return $this;
    }

    /**
     * Get a view instance for a specific route.
     *
     * @param string $route Route to get view for
     * @param array $routeParams Parameters for the route
     *
     * @return null|SSRView
     */
    public function getView($route, $routeParams = [])
    {
        $this->currentRoute = $route;
        $this->routeParams = $routeParams;

        // Check if we have a registered view for this route
        if (isset($this->views[$route])) {
            $viewConfig = $this->views[$route];

            if (\is_callable($viewConfig['view'])) {
                $viewAsset = new ViewAsset($this->defaultInteractiveNamespace, $this->defaultRootElementId, $this->defaultRootElementAttributes);
                $view = \call_user_func($viewConfig['view'], $routeParams, $viewAsset);
                if ($view instanceof SSRView) {
                    return $view->setRouteParams($routeParams);
                }
            } elseif (\is_string($viewConfig['view']) && class_exists($viewConfig['view'])) {
                $viewAsset = new ViewAsset($this->defaultInteractiveNamespace, $this->defaultRootElementId, $this->defaultRootElementAttributes);
                $view = new $viewConfig['view']($viewAsset);
                if ($view instanceof SSRView) {
                    return $view->setRouteParams($routeParams);
                }
            }
        }

        // If no specific view is registered, create a default one with configurable parameters
        $viewAsset = new ViewAsset($this->defaultInteractiveNamespace, $this->defaultRootElementId, $this->defaultRootElementAttributes);

        return new $this->defaultViewClass($viewAsset);
    }

    /**
     * Generate view based on current route and wp_interactivity state/context.
     *
     * @param string $route Route to render
     * @param array $state Optional state data
     * @param array $context Optional context data
     * @param array $viewData Optional view data
     *
     * @return string
     */
    public function generateView($route, $state = [], $context = [], $viewData = [])
    {
        // Normalize route to match file names
        $normalizedRoute = $this->normalizeRoute($route);

        // Get the appropriate view for this route
        $view = $this->getView($normalizedRoute, $this->extractRouteParams($route));

        // Set state and context
        $view->setState($state)
            ->setContext($context)
            ->setViewData($viewData);

        // Register and enqueue assets
        $view->registerAssets();
        // $view->enqueueAssets();

        // Render the view
        return $view->render($normalizedRoute);
    }

    /**
     * Set the default view class.
     *
     * @param string $class
     *
     * @return self
     */
    public function setDefaultViewClass($class)
    {
        $this->defaultViewClass = $class;

        return $this;
    }

    /**
     * Set the default interactive namespace.
     *
     * @param string $namespace
     *
     * @return self
     */
    public function setDefaultInteractiveNamespace($namespace)
    {
        $this->defaultInteractiveNamespace = $namespace;

        return $this;
    }

    /**
     * Set the default root element ID.
     *
     * @param string $id
     *
     * @return self
     */
    public function setDefaultRootElementId($id)
    {
        $this->defaultRootElementId = $id;

        return $this;
    }

    /**
     * Set the default root element attributes.
     *
     * @param array $attributes
     *
     * @return self
     */
    public function setDefaultRootElementAttributes($attributes)
    {
        $this->defaultRootElementAttributes = $attributes;

        return $this;
    }

    /**
     * Check if a view exists for a route.
     *
     * @param string $route Route to check
     *
     * @return bool
     */
    public function hasView($route)
    {
        $normalizedRoute = $this->normalizeRoute($route);

        return isset($this->views[$normalizedRoute]) || SSRData::hasPreRendered($normalizedRoute);
    }

    /**
     * Get all registered views.
     *
     * @return array
     */
    public function getRegisteredViews()
    {
        return $this->views;
    }

    /**
     * Get current route.
     *
     * @return string
     */
    public function getCurrentRoute()
    {
        return $this->currentRoute;
    }

    /**
     * Get route parameters for current route.
     *
     * @return array
     */
    public function getRouteParams()
    {
        return $this->routeParams;
    }

    /**
     * Normalize route to match file names.
     *
     * @param string $route Route to normalize
     *
     * @return string
     */
    private function normalizeRoute($route)
    {
        // Convert route to file name format. Incoming routes are concrete URL
        // paths (e.g. "/login"), which map 1:1 to the prerendered files the
        // prerender step writes (login.html, index.html for "/"). Only static
        // routes are prerendered; dynamic routes simply won't have a file and
        // fall back to the client-side render.
        $normalized = trim($route, '/');

        if ($normalized === '') {
            return 'index.html';
        }

        // Ensure it ends with .html
        if (!str_ends_with($normalized, '.html')) {
            $normalized .= '.html';
        }

        return $normalized;
    }

    /**
     * Extract route parameters from the route.
     *
     * @param string $route Route to extract parameters from
     *
     * @return array
     */
    private function extractRouteParams($route)
    {
        // This is a simplified implementation - in a real scenario, you'd want to match
        // the route against registered patterns to extract actual parameter values
        $params = [];

        // Example: extract ID from /topics/details/123
        if (preg_match('/\/topics\/details\/(\d+)/', $route, $matches)) {
            $params['id'] = $matches[1];
        }

        return $params;
    }
}
