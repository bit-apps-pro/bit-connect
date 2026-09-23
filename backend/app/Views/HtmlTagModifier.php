<?php

// phpcs:disable Squiz.NamingConventions.ValidVariableName.NotCamelCaps

namespace BitApps\BitConnect\Views;

use BitApps\BitConnect\Config;
use BitApps\BitConnect\Deps\BitApps\WPKit\Hooks\Hooks;

if (!defined('ABSPATH')) {
    exit;
}


final class HtmlTagModifier
{
    public function __construct()
    {
        Hooks::addFilter('script_loader_tag', [$this, 'updateScriptAttributes'], 0, 1);
        Hooks::addFilter('script_loader_src', [$this, 'removeQueryParam'], 99999, 3);
    }

    public function updateScriptAttributes($html)
    {
        $slug = Config::SLUG;

        $typeAttribute = 'type="module"';

        $keys = [
            '-vite-client-helper-MODULE-js',
            '-vite-client-MODULE-js',
            '-index-MODULE-js',
        ];

        if (Config::isDev()) {
            foreach ($keys as $key) {
                $handle = 'id="' . $slug . $key . '"';

                if (strpos($html, $handle) !== false) {
                    $html = str_replace($handle, $handle . ' ' . $typeAttribute, $html);
                }
            }
        } else {
            $handle = 'id="' . $slug . '-index-MODULE-js"';

            if (strpos($html, $handle) !== false) {
                $html = str_replace($handle, $handle . ' ' . $typeAttribute, $html);
            }
        }

        return $html;
    }

    public function removeQueryParam($src, $handle)
    {
        if (Config::SLUG . '-index-MODULE' === $handle) {
            $src = strtok($src, '?');
        }

        return $src;
    }
}
