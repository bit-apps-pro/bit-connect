<?php

namespace BitApps\BitConnect\SSR;

use BitApps\BitConnect\Config;

if (!\defined('ABSPATH')) {
    exit;
}

class SSRData
{
    private static $routes = [];

    private static $ssrDir;

    public static function setSsrDir(string $dir)
    {
        self::$ssrDir = rtrim($dir, '/');
    }

    public static function getSsrDir()
    {
        // Default to where the prerender step writes its output
        // (assets/client/ssr) so the SSR dir is always resolved, regardless of
        // bootstrap order. setSsrDir() can still override this (e.g. in tests).
        if (self::$ssrDir === null) {
            self::$ssrDir = rtrim(Config::get('ROOT_DIR') . Config::ASSETS_FOLDER . '/client/ssr', '/');
        }

        return self::$ssrDir;
    }

    public static function getHTML(string $route)
    {
        if (!\in_array($route, self::$routes)) {
            $route = 'index.html';
        }

        return self::hasPreRendered($route) ? file_get_contents(self::getSsrDir() . '/' . $route) : '';
    }

    public static function hasPreRendered(string $route)
    {
        return file_exists(self::getSsrDir() . '/' . $route);
    }

    public static function getAllRoutes()
    {
        return self::$routes;
    }

    public static function setRoutes(array $routes)
    {
        self::$routes = $routes;
    }
}
