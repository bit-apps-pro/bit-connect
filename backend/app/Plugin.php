<?php

namespace BitApps\BitConnect;

// Prevent direct script access
if (!defined('ABSPATH')) {
    exit;
}


use BitApps\BitConnect\Deps\BitApps\WPKit\Hooks\Hooks;
use BitApps\BitConnect\Deps\BitApps\WPKit\Http\RequestType;
use BitApps\BitConnect\Deps\BitApps\WPKit\Migration\MigrationHelper;
use BitApps\BitConnect\Deps\BitApps\WPKit\Utils\Capabilities;
use BitApps\BitConnect\Http\Middleware\AdminCheckerMiddleware;
use BitApps\BitConnect\Http\Middleware\AdminNonceCheckerMiddleware;
use BitApps\BitConnect\Http\Middleware\LoggedInMiddleware;
use BitApps\BitConnect\Http\Middleware\NonceCheckerMiddleware;
use BitApps\BitConnect\Providers\HookProvider;
use BitApps\BitConnect\Providers\InstallerProvider;
use BitApps\BitConnect\Providers\PreInitHookProvider;
use BitApps\BitConnect\Services\CapabilityService;
use BitApps\BitConnect\Views\HtmlTagModifier;
use BitApps\BitConnect\Views\Layout;
use BitApps\BitConnect\Views\PluginPageActions;

final class Plugin
{
    /**
     * Main instance of the plugin.
     *
     * @since 1.0.0-alpha
     *
     * @var null|Plugin
     */
    private static $_instance;

    private $_registeredMiddleware = [];

    /**
     * Initialize the Plugin with hooks.
     */
    public function __construct()
    {
        // Connection::setPluginPrefix(Config::VAR_PREFIX);

        $this->registerInstaller();

        Hooks::addAction('plugins_loaded', [$this, 'loaded']);
    }

    public function registerInstaller()
    {
        $installerProvider = new InstallerProvider();
        $installerProvider->register();
    }

    /**
     * Load the plugin.
     */
    public function loaded()
    {
        Hooks::doAction('bit_connect_loaded');
        new PreInitHookProvider();

        Hooks::addAction('init', [$this, 'registerProviders'], 8);

        Hooks::addFilter('plugin_action_links_' . Config::get('BASENAME'), [new PluginPageActions(), 'renderActionLinks']);

        $this->maybeMigrateDB();
    }

    public function middlewares()
    {
        return [
            'nonce'      => NonceCheckerMiddleware::class,
            'adminNonce' => AdminNonceCheckerMiddleware::class,
            'isAdmin'    => AdminCheckerMiddleware::class,
            'isLoggedIn' => LoggedInMiddleware::class,
        ];
    }

    public function getMiddleware($name)
    {
        if (isset($this->_registeredMiddleware[$name])) {
            return $this->_registeredMiddleware[$name];
        }

        $middlewares = $this->middlewares();

        if (isset($middlewares[$name]) && class_exists($middlewares[$name]) && method_exists($middlewares[$name], 'handle')) {
            $this->_registeredMiddleware[$name] = new $middlewares[$name]();
        } else {
            return false;
        }

        return $this->_registeredMiddleware[$name];
    }

    /**
     * Instantiate the Provider class.
     */
    public function registerProviders()
    {
        if (RequestType::is('admin')) {
            new Layout();
        }

        // Not admin-only: the public portal loads the same module bundle, and
        // its script tag needs type="module" there as much as in wp-admin.
        new HtmlTagModifier();
        new HookProvider();
    }

    public static function maybeMigrateDB()
    {
        if (!Capabilities::check('manage_options')) {
            return;
        }

        if (version_compare(Config::getOption('db_version'), Config::DB_VERSION, '<')) {
            MigrationHelper::migrate(InstallerProvider::migration());
        }

        // Both outside the version gate on purpose. Neither capability change
        // touched the schema, so there is no db_version bump to hang them on,
        // and a site that updates the plugin files in place never fires the
        // activation hook. Their own option guards make each a single
        // autoloaded read once it has run.
        //
        // The order is not load-bearing: contentAuthorityCaps() no longer
        // carries the withdrawn capability, so the split cannot re-grant what
        // the revoke has taken. They are independent and each runs once.
        CapabilityService::migrateModerateSplit();
        CapabilityService::revokeEditAny();

        self::forgetDiagnosticReporting();
    }

    /**
     * Remove what the diagnostic reporting of earlier builds left behind.
     *
     * Earlier builds bundled `bitapps/wp-telemetry`, which kept its consent
     * answer in four options and, once opted in, scheduled a weekly send. The
     * package is gone, so nothing answers that event any more — but WordPress
     * would keep firing it, and the options would keep saying the site had
     * consented to a report that no longer exists. Cleared once, guarded by the
     * option that was always written first.
     */
    public static function forgetDiagnosticReporting(): void
    {
        if (get_option(Config::withPrefix('tracking_notice_dismissed'), null) === null
            && get_option(Config::withPrefix('allow_tracking'), null) === null) {
            return;
        }

        foreach (['allow_tracking', 'tracking_notice_dismissed', 'tracking_skipped', 'tracking_last_sended_at'] as $option) {
            delete_option(Config::withPrefix($option));
        }

        wp_clear_scheduled_hook(Config::withPrefix('send_tracking_event'));
    }

    /**
     * Retrieves the main instance of the plugin.
     *
     * @since 1.0.0-alpha
     *
     * @return Plugin plugin main instance
     */
    public static function instance()
    {
        return self::$_instance;
    }

    /**
     * Loads the plugin main instance and initializes it.
     *
     * @return bool True if the plugin main instance could be loaded, false otherwise
     *
     * @since 1.0.0-alpha
     */
    public static function load()
    {
        if (self::$_instance !== null) {
            return false;
        }

        self::$_instance = new self();

        return true;
    }
}
