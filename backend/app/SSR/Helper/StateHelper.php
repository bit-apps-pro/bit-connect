<?php

namespace BitApps\BitConnect\SSR\Helper;

if (!\defined('ABSPATH')) {
    exit;
}

/**
 * Helper class for managing wp_interactivity state.
 */
class StateHelper
{
    private $namespace;

    private $state = [];

    private $applyCallback;

    public function __construct($namespace, $applyCallback = null)
    {
        $this->namespace = $namespace;
        $this->applyCallback = $applyCallback ?: [$this, 'defaultApply'];
    }

    /**
     * Set a state value.
     *
     * @param string $key State key
     * @param mixed $value State value
     *
     * @return self
     */
    public function set($key, $value)
    {
        $this->state[$key] = $value;

        return $this;
    }

    /**
     * Get a state value.
     *
     * @param string $key State key
     * @param mixed $default Default value if key doesn't exist
     *
     * @return mixed
     */
    public function get($key, $default = null)
    {
        return $this->state[$key] ?? $default;
    }

    /**
     * Set multiple state values at once.
     *
     * @param array $state State data
     *
     * @return self
     */
    public function setMultiple(array $state)
    {
        $this->state = array_merge($this->state, $state);

        return $this;
    }

    /**
     * Remove a state value.
     *
     * @param string $key State key to remove
     *
     * @return self
     */
    public function remove($key)
    {
        unset($this->state[$key]);

        return $this;
    }

    /**
     * Check if a state key exists.
     *
     * @param string $key State key to check
     *
     * @return bool
     */
    public function has($key)
    {
        return isset($this->state[$key]);
    }

    /**
     * Get all state data.
     *
     * @return array
     */
    public function getAll()
    {
        return $this->state;
    }

    /**
     * Clear all state data.
     *
     * @return self
     */
    public function clear()
    {
        $this->state = [];

        return $this;
    }

    /**
     * Apply the state to wp_interactivity API using the callback.
     */
    public function apply()
    {
        \call_user_func($this->applyCallback, $this->namespace, $this->state);
    }

    /**
     * Get the namespace for this state helper.
     *
     * @return string
     */
    public function getNamespace()
    {
        return $this->namespace;
    }

    /**
     * Set the namespace for this state helper.
     *
     * @param string $namespace Namespace to set
     *
     * @return self
     */
    public function setNamespace($namespace)
    {
        $this->namespace = $namespace;

        return $this;
    }

    /**
     * Set a custom apply callback.
     *
     * @return self
     */
    public function setApplyCallback(callable $callback)
    {
        $this->applyCallback = $callback;

        return $this;
    }

    /**
     * Default apply method that uses wp_interactivity_state.
     *
     * @param string $namespace
     * @param array $state
     */
    private function defaultApply($namespace, $state)
    {
        if (!empty($state)) {
            wp_interactivity_state($namespace, $state);
        }
    }
}
