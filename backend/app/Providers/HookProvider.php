<?php

namespace BitApps\BitConnect\Providers;

// Prevent direct script access
if (!\defined('ABSPATH')) {
    exit;
}

use BitApps\BitConnect\Config;
use BitApps\BitConnect\Deps\BitApps\WPKit\Hooks\Hooks;
use BitApps\BitConnect\Deps\BitApps\WPKit\Http\RequestType;
use BitApps\BitConnect\Deps\BitApps\WPKit\Http\Router\Router;
use BitApps\BitConnect\Plugin;
use BitApps\BitConnect\Services\AdminAccessService;
use BitApps\BitConnect\Services\AvatarService;
use BitApps\BitConnect\Services\NotificationMailer;
use BitApps\BitConnect\Services\PortalLocation;
use BitApps\BitConnect\Services\ProfileSlugService;
use BitApps\BitConnect\Services\UserStatsService;
use BitApps\BitConnect\SSR\Seo\PortalSitemap;
use BitApps\BitConnect\SSR\Seo\SeoMeta;
use BitApps\BitConnect\SSR\Seo\SeoPluginBridge;

class HookProvider
{
    private $_pluginBackend;

    public function __construct()
    {
        $this->_pluginBackend = Config::get('BASEDIR') . DIRECTORY_SEPARATOR;

        $this->loadAppAjaxHooks();

        $this->loadAppShortcodes();

        new PostTypeProvider();

        Hooks::addAction('rest_api_init', [$this, 'loadAppApiHooks']);

        // Computes the derived "may open the admin menu" capability. Registered
        // here because this provider runs on init:8, before admin_menu asks.
        AdminAccessService::register();

        // Portal routes resolve on template_redirect, which runs before wp_head,
        // so the head hooks are in place by the time a route has described itself.
        SeoMeta::register();

        // Portal routes are invisible to SEO plugins, which describe the portal
        // *page* instead and stamp its canonical onto every topic. This feeds
        // them the route's own data through their filters so they describe it
        // correctly rather than being fought or stood aside for.
        SeoPluginBridge::register();

        // Sitemap: list portal routes instead of the CPT's own permalinks, and
        // 301 the CPT permalink to its portal equivalent.
        PortalSitemap::register();

        // Same correction for links to a single comment, which core builds from
        // the CPT permalink the sitemap just excluded. Global rather than on the
        // API alone: a comment link is also raised from wp-admin and WP-CLI.
        PortalLocation::registerLinkFilters();

        // A page published with `[bit-connect]` in it becomes the portal when
        // none is configured — the "paste the shortcode" setup path.
        PortalLocation::registerAdoptionHooks();

        // Custom profile pictures. Registered globally rather than per-route so
        // an uploaded avatar replaces Gravatar everywhere the portal renders
        // one — topic cards and comments, not just the profile page.
        AvatarService::registerHooks();

        // Keeps profile slugs current as members register and rename. Existing
        // members are backfilled lazily on first read (ProfileSlugService::slugFor).
        ProfileSlugService::registerHooks();

        // Profile totals are cached; these drop a member's copy as their topics
        // and comments change, including from wp-admin, which the portal's own
        // API never sees.
        UserStatsService::registerHooks();

        // Instant notification email. Registered globally rather than on the API
        // request alone: a notification can be raised from wp-admin or WP-CLI,
        // and the member who asked to be emailed immediately does not care which
        // door the comment came through.
        NotificationMailer::register();

        // The digest and the retention sweep. Schedules on first run and is a
        // no-op afterwards.
        CronProvider::register();

        Hooks::addFilter('query_vars', [$this, 'registerQueryVars']);
        Hooks::addFilter('safe_style_css', [$this, 'allowStyleProperties']);

        // Hide WordPress admin bar on frontend (not in admin area)
        Hooks::addFilter('show_admin_bar', [$this, 'hideAdminBar']);

        // Register the portal page template so the REST API accepts it
        Hooks::addFilter('theme_page_templates', [$this, 'registerPortalPageTemplate']);
        Hooks::addFilter('template_include', [$this, 'loadPortalPageTemplate']);

        if (Config::getEnv('CLI_ACTIVE')) {
            include_once __DIR__ . '/../../../cli/RegisterCommands.php';
        }
    }

    public function registerPortalPageTemplate($templates)
    {
        $templates['bit-connect-portal'] = __('Bit Connect Portal Template', 'bit-connect');

        return $templates;
    }

    public function loadPortalPageTemplate($template)
    {
        if (is_page() && get_post_meta(get_the_ID(), '_wp_page_template', true) === 'bit-connect-portal') {
            $pluginTemplate = Config::get('BASEDIR') . DIRECTORY_SEPARATOR . 'templates' . DIRECTORY_SEPARATOR . 'portal-template.php';
            if (file_exists($pluginTemplate)) {
                return $pluginTemplate;
            }
        }

        return $template;
    }

    public function registerQueryVars($vars)
    {
        $vars[] = 'bc_token';
        // Confirmation link for an email change. Registered for the same reason
        // as bc_token: WordPress strips unknown query vars, and the SPA reads
        // this one to know which flow the visitor arrived in.
        $vars[] = 'bc_email_token';

        return $vars;
    }

    public function allowStyleProperties($styles)
    {
        $styles[] = 'display';

        return $styles;
    }

    /**
     * Hide WordPress admin bar on frontend.
     * Keeps admin bar visible in WordPress admin area.
     *
     * @param bool $show Whether to show the admin bar
     *
     * @return bool
     */
    public function hideAdminBar($show)
    {
        // Only hide on frontend, keep it in admin area
        if (is_admin()) {
            return $show;
        }

        return false;
    }

    public function loadAppApiHooks()
    {
        if (
            is_readable($this->_pluginBackend . 'hooks' . DIRECTORY_SEPARATOR . 'api.php')
            && RequestType::is(RequestType::API)
        ) {
            $router = new Router(RequestType::API, Config::SLUG, 'v1');

            include $this->_pluginBackend . 'hooks' . DIRECTORY_SEPARATOR . 'api.php';
            $router->register();
        }
    }

    /**
     * Helps to register App hooks.
     */
    protected function loadAppAjaxHooks()
    {
        if (
            RequestType::is(RequestType::AJAX)
            && is_readable($this->_pluginBackend . 'hooks' . DIRECTORY_SEPARATOR . 'ajax.php')
        ) {
            $router = new Router(RequestType::AJAX, Config::VAR_PREFIX, '');
            $router->setMiddlewares(Plugin::instance()->middlewares());

            include $this->_pluginBackend . 'hooks' . DIRECTORY_SEPARATOR . 'ajax.php';
            $router->register();
        }
    }

    /**
     * Helps to register shortcodes.
     */
    protected function loadAppShortcodes()
    {
        if (is_readable($this->_pluginBackend . 'hooks' . DIRECTORY_SEPARATOR . 'shortcode.php')) {
            include_once $this->_pluginBackend . 'hooks' . DIRECTORY_SEPARATOR . 'shortcode.php';
        }
    }
}
