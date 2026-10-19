<?php

namespace BitApps\BitConnect\Services;

if (!defined('ABSPATH')) {
    exit;
}

use BitApps\BitConnect\Config;
use BitApps\BitConnect\Enum\Taxonomies;
use BitApps\BitConnect\Providers\HookProvider;

/**
 * Answers the portal app's first REST requests inside the page itself.
 *
 * Each request the app sends when it starts is a full WordPress load on the
 * server and a round trip on the network. On a slow host that was a second or
 * more for each wave of them, before the page showed its content. The server
 * already knows these answers when it draws the page, so it runs the same
 * routes in-process — rest_preload_api_request(), as the block editor does —
 * and the page carries the answers. The app reads each one once, for its first
 * request, and asks the server as before after that.
 *
 * The answers are what the current visitor may see, because they come from the
 * same routes and permission checks: a guest's page carries a guest's answers.
 * A key the app does not ask for exactly is never read, and that request goes
 * to the network as it always did.
 */
final class PortalPreload
{
    /** @var string[] */
    private static array $paths = [];

    /** @var string[] */
    private static array $chunks = [];

    /**
     * Asks for one more request to be answered in the page, by a controller
     * that knows the route — the topic a topic page shows, for example.
     *
     * @param string $path a REST path with its query, as the app sends it
     */
    public static function add(string $path): void
    {
        self::$paths[] = $path;
    }

    /**
     * Asks for one of the app's page chunks to be fetched beside the main
     * bundle, rather than after it has run and asked for the page.
     *
     * @param string $name The chunk's file name before the code name — only
     *                     chunks the build names that way (vite.config.client.mts).
     */
    public static function chunk(string $name): void
    {
        self::$chunks[] = $name;
    }

    /**
     * Prints a modulepreload hint for each chunk asked for. On wp_head, so the
     * browser starts the download while it still reads the rest of the page.
     */
    public static function printChunkHints(): void
    {
        if (Config::isDev()) {
            return;
        }

        $codeName = (string) Config::get('BUILD_CODE_NAME_CLIENT');

        foreach (array_unique(self::$chunks) as $name) {
            printf(
                '<link rel="modulepreload" href="%s" />' . "\n",
                esc_url(Config::get('ASSET_URI') . '/client/' . $name . '-' . $codeName . '.js')
            );
        }
    }

    /**
     * The answers, by path. Only 200 responses are kept, so a route the visitor
     * may not read is left out rather than carried as an error.
     *
     * @return array<string, mixed>
     */
    public static function responses(): array
    {
        if (!\function_exists('rest_preload_api_request')) {
            return [];
        }

        // Starts the REST server, which fires rest_api_init if nothing has yet.
        // The plugin's routes are registered only for REST requests, so they
        // are registered here as well; a second call is a no-op.
        rest_get_server();
        HookProvider::registerApiRoutes();

        $paths = array_values(array_unique(array_merge(self::defaultPaths(), self::$paths)));

        $answers = [];
        foreach (array_reduce($paths, 'rest_preload_api_request', []) as $path => $response) {
            // The headers are left behind: the app reads only the body, and
            // they would double the size of what the page carries.
            $answers[$path] = $response['body'] ?? null;
        }

        return $answers;
    }

    /**
     * What every portal page asks for when it starts: the forum options, the
     * terms topics are filed under, and the stages and statuses lists.
     *
     * @return string[]
     */
    private static function defaultPaths(): array
    {
        $namespace = '/' . Config::SLUG . '/v1';

        return [
            $namespace . '/settings',
            $namespace . '/taxonomies',
            '/wp/v2/' . Taxonomies::STAGES->value . '?per_page=100',
            '/wp/v2/' . Taxonomies::STATUSES->value . '?per_page=100',
        ];
    }
}
