<?php

namespace BitApps\BitConnect\Views;

use BitApps\BitConnect\Config;
use BitApps\BitConnect\Deps\BitApps\WPKit\Helpers\DateTimeHelper;
use BitApps\BitConnect\Deps\BitApps\WPKit\Hooks\Hooks;
use BitApps\BitConnect\Deps\BitApps\WPKit\Utils\Capabilities as WpCapabilities;
use BitApps\BitConnect\Enum\Capabilities;

if (!defined('ABSPATH')) {
    exit;
}


class Head
{
    public const FONT_URL = 'https://fonts.googleapis.com/css2?family=Outfit:wght@100..900&display=swap';

    public function __construct()
    {
        Hooks::addFilter('script_module_data_' . Config::SLUG . '-index-MODULE', [$this, 'createConfigVariable']);
    }

    /**
     * Enqueue the Outfit webfont plus its preconnect hints.
     *
     * Both the admin screens and the public portal render UI that asks for this
     * family, so each entry point calls this rather than duplicating the URLs.
     * wp_enqueue_style() de-duplicates by handle, so calling it twice is safe.
     *
     * @param string $slug plugin slug used to namespace the style handles
     */
    public static function enqueueFont($slug)
    {
        $version = Config::VERSION;

        // null version: these are origin-only preconnect hints (rewritten from
        // rel=stylesheet by HtmlTagModifier), so a ?ver query is meaningless.
        // phpcs:disable WordPress.WP.EnqueuedResourceParameters.MissingVersion -- Preconnect hints carry no file to cache-bust.
        wp_enqueue_style($slug . '-googleapis-PRECONNECT', 'https://fonts.googleapis.com', [], null);
        wp_enqueue_style($slug . '-gstatic-PRECONNECT-CROSSORIGIN', 'https://fonts.gstatic.com', [], null);
        // phpcs:enable WordPress.WP.EnqueuedResourceParameters.MissingVersion
        wp_enqueue_style($slug . '-font', self::FONT_URL, [], $version);
    }

    /**
     * Load the asset libraries.
     *
     * @param string $currentScreen $top_level_page variable for current page
     */
    public function addHeadScripts($currentScreen)
    {
        if (strpos($currentScreen, Config::SLUG) === false) {
            return;
        }

        $version = Config::VERSION;
        $slug = Config::SLUG;

        self::enqueueFont($slug);

        // Inject server variables as a window global so the ES module bundle can access them.
        // wp_localize_script() does not work with wp_enqueue_script_module(), so we use an inline script instead.
        //
        // JSON_HEX_TAG is not decoration: this payload carries admin-authored
        // strings, and one containing `</script>` would otherwise close the tag
        // and run whatever followed. Default encoding happens to escape the
        // slash, which is a coincidence and not a guarantee — SeoMeta::head()
        // passes the flag for the same reason.
        $configJson = wp_json_encode(self::createConfigVariable(), JSON_HEX_TAG | JSON_HEX_AMP);
        wp_register_script($slug . '-module-config', false, [], $version, ['in_footer' => false]);
        wp_enqueue_script($slug . '-module-config');
        wp_add_inline_script($slug . '-module-config', 'window.' . Config::VAR_PREFIX . '=' . $configJson . ';');

        // Runs in the head, before the first paint — see ThemeBoot.
        wp_add_inline_script($slug . '-module-config', ThemeBoot::script());

        if (Config::isDev()) {
            $devUrl = Config::getAdminEndDevUrl();
            wp_enqueue_script_module($slug . '-vite-client-helper-MODULE', $devUrl . '/src/config/devHotModule.js', [], null);
            wp_enqueue_script_module($slug . '-vite-client-MODULE', $devUrl . '/@vite/client', [], null);
            wp_enqueue_script_module($slug . '-index-MODULE', $devUrl . '/src/main.tsx', [], null);
        } else {
            $codeName = Config::get('BUILD_CODE_NAME');
            // phpcs:ignore WordPress.WP.EnqueuedResourceParameters.MissingVersion, WordPress.WP.EnqueuedResourceParameters.NotInFooter -- Version is embedded in the filename via $codeName for cache busting.
            wp_enqueue_script_module($slug . '-index-MODULE', Config::get('ASSET_URI') . "/main-{$codeName}.js", [], null);
            wp_enqueue_style($slug . '-styles', Config::get('ASSET_URI') . "/main-{$slug}-ba-assets-{$codeName}.css", null, $version, 'screen');
        }

        // wp_localize_script(Config::SLUG . '-index-MODULE', Config::VAR_PREFIX, self::createConfigVariable());

        if (!wp_script_is('media-upload')) {
            wp_enqueue_media();
        }
    }

    /**
     * Create config variable for js.
     *
     * @return array
     */
    public static function createConfigVariable()
    {
        // Get the current WordPress post URL if we're on a post/page
        $currentPostUrl = '';
        if (is_singular()) {
            global $post;
            if ($post && isset($post->ID)) {
                $currentPostUrl = get_permalink($post->ID);
            }
        } elseif (is_home()) {
            $currentPostUrl = get_option('home');
        } elseif (is_front_page()) {
            $currentPostUrl = get_option('home');
        } else {
            $currentPostUrl = isset($_SERVER['REQUEST_URI']) ? sanitize_text_field(wp_unslash($_SERVER['REQUEST_URI'])) : '';
        }

        // No option is written here. This used to cache the URL into
        // `bit_connect_page_url` "so AuthService can use it in verification
        // emails", but AuthService::getForumPageUrl() resolves the portal from
        // the `portal_page` option and never read it — so the only effect left
        // was a wp_options write on ordinary page renders, on a payload built
        // for every admin screen load.

        // Extract the path from the URL and remove leading/trailing slashes
        $currentPath = $currentPostUrl ? wp_parse_url($currentPostUrl, PHP_URL_PATH) : '';
        $currentPath = trim($currentPath, '/');
        if ($currentPath === '') {
            $currentPath = '/';
        } else {
            $currentPath = '/' . $currentPath;
        }

        $frontendVars = Hooks::applyFilter(
            Config::withPrefix('localized_script'),
            [
                'nonce'             => wp_create_nonce('wp_rest'),
                'rootURL'           => Config::get('ROOT_URI'),
                'siteURL'           => Config::get('SITE_URL'),
                'siteBaseURL'       => is_multisite() ? network_site_url() : site_url(),
                'assetsURL'         => Config::get('ASSET_URI'),
                'pluginAdminURL'    => get_admin_url(null, 'admin.php?page=' . Config::SLUG . '#'),
                'redirectUri'       => Config::get('REDIRECT_URI'),
                'ajaxURL'           => admin_url('admin-ajax.php'),
                'apiURL'            => Config::get('API_URL'),
                'wpRestURL'         => Config::get('WP_REST_URL'),
                'routePrefix'       => Config::VAR_PREFIX,
                'postURL'           => $currentPath, // WordPress post URL for router basename
                'settings'          => Config::getOption('settings'),
                'dateFormat'        => Config::getOption('date_format', false, true),
                'timeFormat'        => Config::getOption('time_format', false, true),
                'timeZone'          => DateTimeHelper::wp_timezone_string(),
                'pluginSlug'        => Config::SLUG,
                'uploadBaseUrl'     => Config::get('UPLOAD_BASE_URL'),
                'version'           => Config::VERSION,
                'lang'              => get_locale(),
                'currentUserAvatar' => get_avatar_url(get_current_user_id()),
                // The admin app needs these to decide where to land. Its root
                // route is the dashboard, which answers to forum_manage — a
                // moderator arriving there sees a screen of failed requests, so
                // the router sends them to Activity instead.
                'canManage'       => WpCapabilities::check(Capabilities::MANAGE->value),
                'canModerate'     => WpCapabilities::check(Capabilities::MODERATE->value),
                'wpMediaSettings' => [
                    'maxUploadBytes'      => wp_max_upload_size(),
                    'bigImageThresholdPx' => (int) Hooks::applyFilter('big_image_size_threshold', 2560),
                ],
            ]
        );

        if (get_locale() !== 'en_US' && file_exists(Config::get('ROOT_DIR') . '/languages/frontend-extracted-strings.php')) {
            $frontendVars['translations'] = include Config::get('ROOT_DIR') . '/languages/frontend-extracted-strings.php';
        }

        return $frontendVars;
    }
}
