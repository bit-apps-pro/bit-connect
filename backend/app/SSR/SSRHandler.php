<?php

namespace BitApps\BitConnect\SSR;

use BitApps\BitConnect\SSR\Helper\ContextHelper;
use BitApps\BitConnect\SSR\Helper\StateHelper;
use BitApps\BitConnect\SSR\View\ViewManager;

if (!defined('ABSPATH')) {
    exit;
}

class SSRHandler
{
    private ViewManager $viewManager;

    private StateHelper $stateHelper;

    private ContextHelper $contextHelper;

    private string $interactiveNamespace;

    private string $rootElementId;

    private array $rootElementAttributes;

    public function __construct(
        $interactiveNamespace = 'bitConnectStore',
        $rootElementId = 'bit-connect-u-root',
        $rootElementAttributes = ['data-wp-init' => 'callbacks.postWatcher']
    ) {
        $this->interactiveNamespace = $interactiveNamespace;
        $this->rootElementId = $rootElementId;
        $this->rootElementAttributes = $rootElementAttributes;

        // Initialize ViewManager with configuration
        $this->viewManager = ViewManager::getInstance(
            null, // Use default SSRView class
            $this->interactiveNamespace,
            $this->rootElementId,
            $this->rootElementAttributes
        );

        $this->stateHelper = new StateHelper($interactiveNamespace);
        $this->contextHelper = new ContextHelper();
    }

    /**
     * Generate view based on route with wp_interactivity state and context.
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
        return $this->viewManager->generateView($route, $state, $context, $viewData);
    }

    /**
     * Get the view manager instance.
     *
     * @return ViewManager
     */
    public function getViewManager()
    {
        return $this->viewManager;
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
        $this->interactiveNamespace = $namespace;
        $this->stateHelper = new StateHelper($namespace, 'init');
        $this->viewManager = ViewManager::getInstance(
            null,
            $namespace,
            $this->rootElementId,
            $this->rootElementAttributes
        );

        return $this;
    }

    /**
     * Get the interactive namespace.
     *
     * @return string
     */
    public function getInteractiveNamespace()
    {
        return $this->interactiveNamespace;
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
        $this->rootElementId = $id;
        $this->viewManager = ViewManager::getInstance(
            null,
            $this->interactiveNamespace,
            $id,
            $this->rootElementAttributes
        );

        return $this;
    }

    /**
     * Get the root element ID.
     *
     * @return string
     */
    public function getRootElementId()
    {
        return $this->rootElementId;
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
        $this->rootElementAttributes = $attributes;
        $this->viewManager = ViewManager::getInstance(
            null,
            $this->interactiveNamespace,
            $this->rootElementId,
            $attributes
        );

        return $this;
    }

    /**
     * Get root element attributes.
     *
     * @return array
     */
    public function getRootElementAttributes()
    {
        return $this->rootElementAttributes;
    }
}
