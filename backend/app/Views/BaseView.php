<?php

namespace BitApps\BitConnect\Views;

use BitApps\BitConnect\Config;
use BitApps\BitConnect\Deps\BitApps\WPKit\Hooks\Hooks;
use BitApps\BitConnect\Enum\GeneralSettings;
use BitApps\BitConnect\Services\AuthService;
use BitApps\BitConnect\Services\NotificationService;
use BitApps\BitConnect\Services\StageService;
use BitApps\BitConnect\Services\StatusService;
use WP_Post;

if (!\defined('ABSPATH')) {
    exit;
}


class BaseView
{
    public string $slug;

    public string $version;

    /**
     * Several owners construct a BaseView per request (route controllers,
     * ShortCode), and each instance is a distinct callback to WordPress — so
     * without this guard the config payload and inline scripts printed once
     * per instance. Register the hooks only for the first instance.
     */
    private static bool $hooksRegistered = false;

    public function __construct()
    {
        $this->version = Config::VERSION;
        $this->slug = Config::SLUG . '-sc';

        if (!self::$hooksRegistered) {
            self::$hooksRegistered = true;
            Hooks::addAction('wp_enqueue_scripts', [$this, 'enqueueAssets']);
        }
    }

    public function registerAssets()
    {
        if (Config::isDev()) {
            $devUrl = Config::getClientEndDevUrl();
            wp_register_script_module($this->slug . '-MODULE-vite-client-helper', $devUrl . '/src/config/devHotModule.js', [], null);
            wp_register_script_module($this->slug . '-MODULE-vite-client', $devUrl . '/@vite/client', [], null);
            wp_register_script_module($this->slug . '-MODULE-main', $devUrl . '/src/main.tsx', ['@wordpress/interactivity'], null);
        } else {
            $codeName = Config::get('BUILD_CODE_NAME_CLIENT');
            $slug = Config::SLUG;
            // phpcs:ignore WordPress.WP.EnqueuedResourceParameters.MissingVersion, WordPress.WP.EnqueuedResourceParameters.NotInFooter -- Version is embedded in the filename via $codeName for cache busting.
            wp_register_script_module($this->slug . '-MODULE-main', Config::get('ASSET_URI') . "/client/main-{$codeName}.js", ['@wordpress/interactivity'], null);
            wp_register_style($this->slug . '-styles', Config::get('ASSET_URI') . "/client/main-{$slug}-ba-assets-{$codeName}.css", null, $this->version, 'screen');
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
            $currentPostUrl = $_SERVER['REQUEST_URI'] ?? '';
        }

        // A home URL with no trailing slash ("https://example.com") has no path
        // component, so parse_url() returns null there — which trim() has
        // deprecated as an argument since PHP 8.1.
        $currentPath = $currentPostUrl ? trim(parse_url($currentPostUrl, PHP_URL_PATH) ?? '', '/') : '';

        if ($currentPath === '') {
            $currentPath = '/';
        } else {
            $currentPath = '/' . $currentPath;
        }
        $userInfo = Config::getCurrentUserInfo();
        $generalSettings = Config::getOption(GeneralSettings::OPTION_NAME->value, []);
        $frontendVars = [
            'nonce' => wp_create_nonce('wp_rest'),
            // The config atom keys its localStorage blob `${pluginSlug}-config`;
            // ThemeBoot::script() reads the same key server-side, so the two
            // fall out of sync on any route that omits this.
            'pluginSlug'             => Config::SLUG,
            'assetsURL'              => Config::get('ASSET_URI'),
            'apiURL'                 => Config::get('API_URL'),
            'routePrefix'            => Config::VAR_PREFIX,
            'postURL'                => $currentPath, // WordPress post URL for router basename
            'settings'               => Config::getOption('settings'),
            'dateFormat'             => Config::getOption('date_format', false, true),
            'timeFormat'             => Config::getOption('time_format', false, true),
            'siteURL'                => Config::get('SITE_URL'),
            'version'                => Config::VERSION,
            'lang'                   => get_locale(),
            'wpRestURL'              => Config::get('WP_REST_URL'),
            'isLoggedIn'             => $userInfo['isLoggedIn'],
            'currentUser'            => $userInfo['user'],
            'currentUserAvatar'      => $userInfo['user'] ? $userInfo['user']['avatar'] : '',
            'authMode'               => AuthService::getMode(),
            'customLoginUrl'         => AuthService::customLoginUrl(),
            'customRegistrationUrl'  => AuthService::customRegistrationUrl(),
            'canRegister'            => AuthService::canRegister(),
            'wpLoginURL'             => wp_login_url(),
            'wpRegisterURL'          => wp_registration_url(),
            'loginPageCustomization' => AuthService::getSettings()['loginPageCustomization'] ?? ['banner' => '', 'title' => '', 'description' => ''],
            'communityTitle'         => $generalSettings['communityTitle'] ?? '',
            'logoLight'              => $generalSettings['logoLight'] ?? '',
            'logoPermalinkMode'      => $generalSettings['logoPermalinkMode'] ?? 'default',
            'logoPermalinkCustom'    => $generalSettings['logoPermalinkCustom'] ?? '',
            'portalAccess'           => $generalSettings['portalAccess'] ?? 'everyone',
            'portalFilters'          => GeneralSettings::portalFilters($generalSettings),
            'promo'                  => GeneralSettings::promo($generalSettings),
            'defaultStageSlug'       => StageService::defaultStageSlug(),
            'defaultStatusSlug'      => StatusService::defaultStatusSlug(),
            'wpMediaSettings'        => [
                'maxUploadBytes'      => wp_max_upload_size(),
                'bigImageThresholdPx' => (int) Hooks::applyFilter('big_image_size_threshold', 2560),
            ],
            // Sent with the page so the bell's badge is right on first paint
            // instead of appearing a beat after the header draws. The portal
            // polls for changes after that; this is only the starting value.
            // Cached per member and dropped on write, so it costs a transient
            // read on the overwhelming majority of page loads. (Ported from
            // ShortCode's removed copy of this method — the two had drifted.)
            'unreadNotifications' => $userInfo['isLoggedIn']
                ? NotificationService::unreadCount(get_current_user_id())
                : 0,
        ];

        // Same extension point Head uses for the admin payload. The portal needs
        // it too — pro features render here, and without the filter the pro
        // plugin could inject `isPro` into wp-admin but never into the portal.
        $frontendVars = Hooks::applyFilter(Config::withPrefix('localized_script'), $frontendVars);

        if (get_locale() !== 'en_US' && file_exists(Config::get('ROOT_DIR') . '/languages/shortcode-extracted-strings.php')) {
            $frontendVars['translations'] = include Config::get('ROOT_DIR') . '/languages/shortcode-extracted-strings.php';
        }

        return $frontendVars;
    }

    public function enqueueAssets()
    {
        // On a block theme WordPress prints the import map in wp_head, and only
        // for modules already registered by then. The shortcode registers the
        // module when it renders — during the_content, after wp_head — so on the
        // shortcode page the bundle's bare `@wordpress/interactivity` import had
        // no map to resolve against and the portal never hydrated. Classic
        // themes print the map in the footer, which is why this stayed hidden.
        // Register up front when this request will render the shortcode; the
        // routed portal pages already register on template_redirect, and
        // registration is idempotent so the shortcode's later call is harmless.
        $post = get_post();
        if (is_singular() && $post instanceof WP_Post && has_shortcode($post->post_content, 'bit-connect')) {
            $this->registerAssets();
        }

        // The portal's stylesheet asks for the Outfit family, but Head::addHeadScripts()
        // only runs on the plugin's wp-admin screens — so without this the public portal
        // silently fell back to the visitor's system UI font.
        Head::enqueueFont($this->slug);

        // This inline global is the bundle's only config transport: the Vite
        // build `define`s every bare SERVER_VARIABLES read to
        // `window.bit_connect_` (see vite.config.client.mts + .env), so the
        // payload must be on the page before the module executes. A
        // script_module_data_* filter used to print the same payload a second
        // time as JSON nothing read — that duplicate is gone.
        // JSON_HEX_TAG: this runs on the public portal and the payload carries
        // admin-authored copy (community title, promo text, login-page wording)
        // plus the current member's display name. One `</script>` in any of
        // them would close this inline block. See SeoMeta::head().
        $configJson = wp_json_encode(self::createConfigVariable(), JSON_HEX_TAG | JSON_HEX_AMP);
        wp_register_script($this->slug . '-module-config', false, [], false, ['in_footer' => false]);
        wp_enqueue_script($this->slug . '-module-config');
        wp_add_inline_script($this->slug . '-module-config', 'window.' . Config::VAR_PREFIX . '=' . $configJson . ';');

        // Runs in the head, before the first paint — see ThemeBoot.
        wp_add_inline_script($this->slug . '-module-config', ThemeBoot::script());

        if (Config::isDev()) {
            wp_enqueue_script_module($this->slug . '-MODULE-vite-client-helper');
            wp_enqueue_script_module($this->slug . '-MODULE-vite-client');
            wp_enqueue_script_module($this->slug . '-MODULE-main');
        } else {
            wp_enqueue_script_module($this->slug . '-MODULE-main');
            wp_enqueue_style($this->slug . '-styles');
        }
        if (!wp_script_is('media-upload')) {
            wp_enqueue_media();
        }
    }
}
