<?php

namespace BitApps\BitConnect\SSR\View;

if (!defined('ABSPATH')) {
    exit;
}

/**
 * ViewAsset class to manage assets for views.
 * Handles callbacks for wp_register_* and wp_enqueue_* functions.
 */
class ViewAsset
{
    private array $registerCallbacks = [];

    private array $enqueueCallbacks = [];

    private string $template;

    private string $interactiveNamespace;

    private string $rootElementId;

    private array $rootElementAttributes;

    public function __construct(string $interactiveNamespace = 'wpStore', string $rootElementId = 'wp-interactive-root', array $rootElementAttributes = [])
    {
        $this->template = $this->getDefaultTemplate();
        $this->interactiveNamespace = $interactiveNamespace;
        $this->rootElementId = $rootElementId;
        $this->rootElementAttributes = $rootElementAttributes;
    }

    /**
     * Add a callback for registering assets.
     *
     * @param callable $callback Callback function to register assets
     */
    public function addRegisterCallback(callable $callback): self
    {
        $this->registerCallbacks[] = $callback;

        return $this;
    }

    /**
     * Add a callback for enqueuing assets.
     *
     * @param callable $callback Callback function to enqueue assets
     */
    public function addEnqueueCallback(callable $callback): self
    {
        $this->enqueueCallbacks[] = $callback;

        return $this;
    }

    /**
     * Execute all register callbacks.
     */
    public function registerAssets(): void
    {
        foreach ($this->registerCallbacks as $callback) {
            \call_user_func($callback);
        }
    }

    /**
     * Execute all enqueue callbacks.
     */
    public function enqueueAssets(): void
    {
        foreach ($this->enqueueCallbacks as $callback) {
            \call_user_func($callback);
        }
    }

    /**
     * Get all register callbacks.
     */
    public function getRegisterCallbacks(): array
    {
        return $this->registerCallbacks;
    }

    /**
     * Get all enqueue callbacks.
     */
    public function getEnqueueCallbacks(): array
    {
        return $this->enqueueCallbacks;
    }

    /**
     * Clear all register callbacks.
     */
    public function clearRegisterCallbacks(): self
    {
        $this->registerCallbacks = [];

        return $this;
    }

    /**
     * Clear all enqueue callbacks.
     */
    public function clearEnqueueCallbacks(): self
    {
        $this->enqueueCallbacks = [];

        return $this;
    }

    /**
     * Clear all callbacks.
     */
    public function clearAllCallbacks(): self
    {
        $this->registerCallbacks = [];
        $this->enqueueCallbacks = [];

        return $this;
    }

    /**
     * Get the template.
     */
    public function getTemplate(): string
    {
        return $this->template;
    }

    /**
     * Set the template.
     */
    public function setTemplate(string $template): self
    {
        $this->template = $template;

        return $this;
    }

    /**
     * Get the interactive namespace.
     */
    public function getInteractiveNamespace(): string
    {
        return $this->interactiveNamespace;
    }

    /**
     * Set the interactive namespace.
     */
    public function setInteractiveNamespace(string $namespace): self
    {
        $this->interactiveNamespace = $namespace;

        return $this;
    }

    /**
     * Get the root element ID.
     */
    public function getRootElementId(): string
    {
        return $this->rootElementId;
    }

    /**
     * Set the root element ID.
     */
    public function setRootElementId(string $id): self
    {
        $this->rootElementId = $id;

        return $this;
    }

    /**
     * Get the root element attributes.
     */
    public function getRootElementAttributes(): array
    {
        return $this->rootElementAttributes;
    }

    /**
     * Set the root element attributes.
     */
    public function setRootElementAttributes(array $attributes): self
    {
        $this->rootElementAttributes = $attributes;

        return $this;
    }

    /**
     * Get default template name.
     */
    protected function getDefaultTemplate(): string
    {
        return 'index';
    }
}
