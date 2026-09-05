<?php

namespace BitApps\BitConnect\SSR\Helper;

if (!\defined('ABSPATH')) {
    exit;
}

/**
 * Helper class for managing wp_interactivity context.
 */
class ContextHelper
{
    private $context = [];

    private $selector = '[data-wp-context]';

    private $attributeName = 'data-wp-context';

    /**
     * Constructor to allow configuration of selector and attribute name.
     *
     * @param array $initialContext Initial context data
     * @param string $selector CSS selector for elements that should receive context
     * @param string $attributeName Attribute name to use for context
     */
    public function __construct($initialContext = [], $selector = '[data-wp-context]', $attributeName = 'data-wp-context')
    {
        $this->context = $initialContext;
        $this->selector = $selector;
        $this->attributeName = $attributeName;
    }

    /**
     * Set a context value.
     *
     * @param string $key Context key
     * @param mixed $value Context value
     *
     * @return self
     */
    public function set($key, $value)
    {
        $this->context[$key] = $value;

        return $this;
    }

    /**
     * Get a context value.
     *
     * @param string $key Context key
     * @param mixed $default Default value if key doesn't exist
     *
     * @return mixed
     */
    public function get($key, $default = null)
    {
        return $this->context[$key] ?? $default;
    }

    /**
     * Set multiple context values at once.
     *
     * @param array $context Context data
     *
     * @return self
     */
    public function setMultiple(array $context)
    {
        $this->context = array_merge($this->context, $context);

        return $this;
    }

    /**
     * Remove a context value.
     *
     * @param string $key Context key to remove
     *
     * @return self
     */
    public function remove($key)
    {
        unset($this->context[$key]);

        return $this;
    }

    /**
     * Check if a context key exists.
     *
     * @param string $key Context key to check
     *
     * @return bool
     */
    public function has($key)
    {
        return isset($this->context[$key]);
    }

    /**
     * Get all context data.
     *
     * @return array
     */
    public function getAll()
    {
        return $this->context;
    }

    /**
     * Clear all context data.
     *
     * @return self
     */
    public function clear()
    {
        $this->context = [];

        return $this;
    }

    /**
     * Generate data-wp-context attribute string.
     *
     * @return string
     */
    public function toWpContextAttribute()
    {
        if (empty($this->context)) {
            return '';
        }

        // Encode context data for use in HTML attribute
        $encodedContext = wp_json_encode($this->context);

        return $this->attributeName . '=\'' . esc_attr($encodedContext) . '\'';
    }

    /**
     * Apply context to an HTML element by adding data-wp-context attribute.
     *
     * @param string $html HTML to apply context to
     *
     * @return string
     */
    public function applyToHtml($html)
    {
        if (empty($this->context)) {
            return $html;
        }

        $contextAttr = $this->toWpContextAttribute();

        // Add the context attribute to the first opening tag
        return preg_replace('/^(\s*<\w+)/', '$1 ' . $contextAttr, $html, 1);
    }

    /**
     * Apply context to HTML elements matching the selector.
     *
     * @param string $html HTML to apply context to
     *
     * @return string
     */
    public function applyToMatchingElements($html)
    {
        if (empty($this->context)) {
            return $html;
        }

        $contextAttr = $this->toWpContextAttribute();

        // Simple implementation: add context to the root element
        // In a more advanced implementation, you could parse HTML and apply to matching selectors
        return preg_replace('/^(\s*<\w+)/', '$1 ' . $contextAttr, $html, 1);
    }

    /**
     * Get the CSS selector used for context application.
     *
     * @return string
     */
    public function getSelector()
    {
        return $this->selector;
    }

    /**
     * Set the CSS selector used for context application.
     *
     * @param string $selector
     *
     * @return self
     */
    public function setSelector($selector)
    {
        $this->selector = $selector;

        return $this;
    }

    /**
     * Get the attribute name used for context.
     *
     * @return string
     */
    public function getAttributeName()
    {
        return $this->attributeName;
    }

    /**
     * Set the attribute name used for context.
     *
     * @param string $attributeName
     *
     * @return self
     */
    public function setAttributeName($attributeName)
    {
        $this->attributeName = $attributeName;

        return $this;
    }
}
