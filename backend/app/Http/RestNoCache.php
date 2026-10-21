<?php

namespace BitApps\BitConnect\Http;

// Prevent direct script access
if (!defined('ABSPATH')) {
    exit;
}

use BitApps\BitConnect\Deps\BitApps\WPKit\Hooks\Hooks;
use WP_HTTP_Response;
use WP_REST_Request;

/**
 * Keeps page caches away from this plugin's REST responses.
 *
 * Every answer here is read for one user at one moment: the admin's topic
 * table, a member's notifications, the portal's lists. A page cache that
 * keeps a GET — LiteSpeed Cache does so for the REST API unless told
 * otherwise — serves the old answer after a write, because a write such as a
 * pin changes an option, not a post, and so purges nothing. The table then
 * shows the old state until someone empties the cache by hand.
 *
 * WordPress already sends no-cache headers to a signed-in user, but a server
 * cache does not always read them. This says it in the forms the common ones
 * do read: the standard header, LiteSpeed's own header, and the
 * `DONOTCACHEPAGE` constant that the cache plugins check.
 */
final class RestNoCache
{
    /**
     * Marks every response under the namespace as not to be cached.
     *
     * @param string $namespace for example `bit-connect/v1`
     */
    public static function register(string $namespace): void
    {
        $prefix = '/' . trim($namespace, '/') . '/';

        Hooks::addFilter(
            'rest_post_dispatch',
            static function ($response, $server, $request) use ($prefix) {
                return self::mark($response, $request, $prefix);
            },
            10,
            3
        );
    }

    /**
     * @param mixed $response
     * @param mixed $request
     *
     * @return mixed
     */
    public static function mark($response, $request, string $prefix)
    {
        if (!$response instanceof WP_HTTP_Response || !$request instanceof WP_REST_Request) {
            return $response;
        }

        if (strpos($request->get_route() . '/', $prefix) !== 0) {
            return $response;
        }

        $response->header('Cache-Control', 'no-cache, no-store, must-revalidate, max-age=0');
        $response->header('X-LiteSpeed-Cache-Control', 'no-cache');

        // The cache plugins' shared signal. LiteSpeed Cache reads it when it
        // writes its own header, which would otherwise replace the one above.
        //
        // Only on a REST request. PortalPreload runs these routes inside a
        // portal page, and core fires this filter there too: defined then, the
        // constant told every cache plugin to keep no portal page at all, for
        // guests as well. The headers above go on a response the page drops.
        if (self::servesRestRequest() && !defined('DONOTCACHEPAGE')) {
            \define('DONOTCACHEPAGE', true);
        }

        return $response;
    }

    /**
     * Whether the request being answered is a REST request, not a page that
     * runs REST routes in-process.
     */
    public static function servesRestRequest(): bool
    {
        return wp_is_serving_rest_request();
    }
}
