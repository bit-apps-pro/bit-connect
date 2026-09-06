<?php

namespace BitApps\BitConnect;

// A class this plugin deliberately does not ship. Safe to reference because
// every use of it sits inside isProActivated()'s class_exists() guard.
use BitApps\BitConnect\Deps\BitApps\WPDatabase\Connection;
use BitApps\BitConnect\Enum\PostTypes;
use BitApps\BitConnect\Services\AuthService;
use BitApps\BitConnect\Services\EmailChangeService;
use BitApps\BitConnect\Services\PermissionService;
use BitApps\BitConnect\Services\ProfileSlugService;
use BitApps\BitConnect\Views\Body;
use BitApps\BitConnect\Views\Menu;
use BitApps\BitConnect\Views\PluginPageActions;
use BitApps\BitConnectPro\Config as ProConfig;

if (!defined('ABSPATH')) {
    exit;
}

/**
 * Provides App configurations.
 */
class Config
{
    // Single source of truth: the plugin slug and the primary post type share
    // the same value. Deriving SLUG from the enum keeps them from drifting.
    public const SLUG = PostTypes::BIT_CONNECT->value;

    public const PRO_PLUGIN_SLUG = 'bit-connect-pro';

    public const TITLE = 'Bit Connect';

    public const VAR_PREFIX = 'bit_connect_';

    public const PORTAL_PAGE_POST_TYPE = 'bit_connect_portal';

    public const VERSION = '1.0.0';

    public const DB_VERSION = '1.0.0';

    /**
     * Must match the `Requires PHP` and `Requires at least` headers in
     * bit-connect.php — the Installer refuses activation below these, and a
     * value under the header's is worse than none: the code is PHP 8.2 (enums,
     * match, readonly promotion), so an install it lets through fails with a
     * parse error instead of the notice this is here to produce.
     */
    public const REQUIRED_PHP_VERSION = '8.2';

    public const REQUIRED_WP_VERSION = '6.8';

    public const API_VERSION = '1.0';

    public const APP_BASE = '../../' . self::SLUG . '.php';

    public const CLASS_PREFIX = 'BitApps\BitConnect';

    public const ASSETS_FOLDER = 'assets';

    public const PRO_PLUGIN_NAMESPACE = 'BitApps\BitConnectPro\\';

    /**
     * Where the optional diagnostic report goes.
     *
     * Named here rather than inline at the one call site because
     * TelemetryService has to recognise a request to it in `pre_http_request`,
     * and the two must not drift — a base URL that no longer matches would
     * silently stop refusing unconsented sends.
     */
    public const TELEMETRY_SERVER_URL = 'https://wp-api.bitapps.pro/public/';

    public const TERMS_URL = 'https://bitapps.pro/terms-of-service/';

    public const PRIVACY_POLICY_URL = 'https://bitapps.pro/privacy-policy/';

    /**
     * Provides configuration for plugin.
     *
     * @param string $type    Type of conf
     * @param string $default Default value
     *
     * @return null|array|string
     */
    public static function get($type, $default = null)
    {
        switch ($type) {
            case 'MAIN_FILE':
                return realpath(__DIR__ . DIRECTORY_SEPARATOR . self::APP_BASE);

            case 'BASENAME':
                return plugin_basename(trim(self::get('MAIN_FILE')));

            case 'ROOT_DIR':
                return plugin_dir_path(self::get('MAIN_FILE'));

            case 'BASEDIR':
                return self::get('ROOT_DIR') . 'backend';

            case 'UPLOAD_BASE_URL':
                return wp_upload_dir()['baseurl'];

            case 'UPLOAD_BASE_DIR':
                return wp_upload_dir()['basedir'];

            case 'SITE_URL':
                return site_url();

            case 'ADMIN_URL':
                return str_replace(self::get('SITE_URL'), '', get_admin_url());

            case 'WP_REST_URL':
                return get_rest_url(null, '/wp/v2');

            case 'API_URL':
                return get_rest_url(null, '/' . self::SLUG . '/v1');

            case 'WP_REST_URI':
                return get_rest_url();

            case 'ROOT_URI':
                return set_url_scheme(plugins_url('', self::get('MAIN_FILE')), wp_parse_url(home_url())['scheme']);

                // The three asset cases below hand over to the pro plugin
                // wholesale: pro ships no view layer of its own, so the free
                // plugin is what enqueues the pro bundle.
                //
                // The gate is *installed*, not *licensed*, and that matters. The
                // pro bundle is the only one containing the license screen, so
                // serving free assets to an unlicensed pro install would leave
                // the site with no way to enter a key — the feature could never
                // be switched on. Serving the pro bundle unlicensed is safe:
                // IS_PRO_ACTIVE on the frontend is the bundle flag AND the
                // license, so every pro control still reads as locked.
            case 'ASSET_URI':
                if (self::isProInstalled()) {
                    return ProConfig::get('ASSET_URI');
                }

                return self::get('ROOT_URI') . '/' . self::ASSETS_FOLDER;

            case 'BUILD_CODE_NAME':
                if (self::isProInstalled()) {
                    return ProConfig::get('BUILD_CODE_NAME');
                }

                return self::readBuildCodeName(self::ASSETS_FOLDER . '/build-code-name.txt');

            case 'BUILD_CODE_NAME_CLIENT':
                if (self::isProInstalled()) {
                    return ProConfig::get('BUILD_CODE_NAME_CLIENT');
                }

                return self::readBuildCodeName(self::ASSETS_FOLDER . '/client/build-code-name.txt');

            case 'PLUGIN_PAGE_LINKS':
                return (new PluginPageActions())->getActionLinks();

            case 'SIDE_BAR_MENU':
                return Menu::getSideBarMenu(new Body());

            case 'WP_DB_PREFIX':
                return Connection::prop('prefix');

            case 'REDIRECT_URI':
                $isPlainPermalink = get_option('permalink_structure') === '';

                if ($isPlainPermalink) {
                    return self::get('SITE_URL') . '/?pagename=' . self::SLUG . '-oauth-callback';
                }

                return self::get('SITE_URL') . '/' . Config::SLUG . '/oauth-callback/';

            default:
                return $default;
        }
    }

    /**
     * Whether the pro add-on is installed *and* holds a valid license.
     *
     * Two distinct states matter: installed (the class resolves) and licensed
     * (the pro plugin says so). This answers the second, which is the one that
     * should unlock behaviour. Callers that only need "is pro present" should
     * ask class_exists directly.
     *
     * Do not call this before plugins_loaded:12 — the pro plugin configures the
     * option prefix its license lives under at priority 11.
     *
     * @return bool
     */
    public static function isProActivated()
    {
        if (self::isProInstalled()) {
            return ProConfig::isPro();
        }

        return false;
    }

    /**
     * Whether the pro add-on's code is present, licensed or not.
     *
     * Asset serving asks this rather than isProActivated(): the pro bundle
     * carries the license screen, so an unlicensed install still needs it.
     * Anything that unlocks a paid feature must ask isProActivated() instead.
     *
     * @return bool
     */
    public static function isProInstalled()
    {
        return class_exists(ProConfig::class);
    }

    /**
     * Reads a build's code name, which the asset filenames are stamped with.
     *
     * @param string $relativePath Path under the plugin root
     *
     * @return string
     */
    public static function readBuildCodeName($relativePath)
    {
        $file = self::get('ROOT_DIR') . $relativePath;

        return file_exists($file) ? trim(file_get_contents($file)) : '';
    }

    /**
     * Prefixed variable name with prefix.
     *
     * @param string $option Variable name
     *
     * @return string
     */
    public static function withPrefix($option)
    {
        return self::VAR_PREFIX . $option;
    }

    /**
     * Prefixed table name with db prefix and var prefix.
     *
     * @param mixed $table
     *
     * @return string
     */
    public static function withDBPrefix($table)
    {
        return self::get('WP_DB_PREFIX') . self::withPrefix($table);
    }

    /**
     * Retrieves options from option table.
     *
     * @param string $option  Option name
     * @param mixed   $default default value
     * @param bool   $wp      Whether option is default wp option
     *
     * @return mixed
     */
    public static function getOption($option, $default = false, $wp = false)
    {
        if ($wp) {
            return get_option($option, $default);
        }

        return get_option(self::withPrefix($option), $default);
    }

    /**
     * Saves option to option table.
     *
     * @param string $option   Option name
     * @param bool   $autoload Whether option will autoload
     * @param mixed  $value
     *
     * @return bool
     */
    public static function addOption($option, $value, $autoload = false)
    {
        return add_option(self::withPrefix($option), $value, '', $autoload ? true : null);
    }

    /**
     * Save or update option to option table.
     *
     * @param string $option   Option name
     * @param mixed  $value    Option value
     * @param bool   $autoload Whether option will autoload
     *
     * @return bool
     */
    public static function updateOption($option, $value, $autoload = null)
    {
        return update_option(self::withPrefix($option), $value, \is_null($autoload) ? null : true);
    }

    public static function deleteOption($option)
    {
        return delete_option(self::withPrefix($option));
    }

    public static function getEnv($keyName)
    {
        return isset($_ENV[Config::VAR_PREFIX . $keyName]) ? sanitize_text_field($_ENV[Config::VAR_PREFIX . $keyName]) : false;
    }

    public static function isDev()
    {
        // return false;

        return getenv('BIT_CONNECT_FRONTEND_ADMIN_HOST') || getenv('BIT_CONNECT_FRONTEND_CLIENT_HOST') || static::hasDevPort();
    }

    public static function hasDevPort()
    {
        return is_readable(Config::get('ROOT_DIR') . '/.port');
    }

    public static function adminDevPort()
    {
        return static::hasDevPort() ? trim(file_get_contents(Config::get('ROOT_DIR') . '/.port')) : 3000;
    }

    public static function clientDevPort()
    {
        return is_readable(Config::get('ROOT_DIR') . '/.port-client') ? trim(file_get_contents(Config::get('ROOT_DIR') . '/.port-client')) : 3001;
    }

    public static function getAdminEndDevUrl()
    {
        $envHost = getenv('BIT_CONNECT_FRONTEND_ADMIN_HOST');

        return static::hasDevPort() && !$envHost ? 'http://localhost:' . static::adminDevPort() : $envHost;
    }

    public static function getClientEndDevUrl()
    {
        $envHost = getenv('BIT_CONNECT_FRONTEND_CLIENT_HOST');

        return static::hasDevPort() && !$envHost ? 'http://localhost:' . static::clientDevPort() : $envHost;
    }

    /**
     * Get current user information and login status.
     *
     * @return array{
     *   isLoggedIn: bool,
     *   user: null|array{
     *     id: int,
     *     username: string,
     *     email: string,
     *     display_name: string,
     *     avatar: string,
     *     role: null|string,
     *     roles: array<int, string>,
     *     pending_email: string,
     *     has_password: bool
     *   }
     * }
     */
    public static function getCurrentUserInfo()
    {
        if (!is_user_logged_in()) {
            return [
                'isLoggedIn' => false,
                'user'       => null,
            ];
        }

        $user = wp_get_current_user();
        $roles = \is_array($user->roles ?? null) ? array_values($user->roles) : [];

        return [
            'isLoggedIn' => true,
            'user'       => [
                'id'           => $user->ID,
                'username'     => $user->user_login,
                'slug'         => ProfileSlugService::slugFor($user->ID),
                'email'        => $user->user_email,
                'display_name' => $user->display_name,
                'avatar'       => get_avatar_url($user->ID),
                'role'         => $roles[0] ?? null,
                'roles'        => $roles,
                // Both also come back from auth/me, but the portal only calls
                // that when it has no user yet — a logged-in visitor is seeded
                // from here and never refetches. Omitting them would leave the
                // settings form blind to a pending email change and to a
                // passwordless SSO account on every fresh page load.
                'pending_email' => EmailChangeService::pendingEmail($user->ID),
                'has_password'  => AuthService::hasUsablePassword($user->ID),
                // What this member may actually do, so the portal gates its
                // controls on capabilities rather than on the role slug — which
                // says nothing about the caps Manager granted the role.
                'capabilities' => PermissionService::currentUserCapabilities(),
            ],
        ];
    }
}
