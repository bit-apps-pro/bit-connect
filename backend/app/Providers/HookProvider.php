<?php

namespace BitApps\BitConnect\Providers;

// Prevent direct script access
if (!defined('ABSPATH')) {
    exit;
}

use BitApps\BitConnect\Config;
use BitApps\BitConnect\Deps\BitApps\WPKit\Hooks\Hooks;
use BitApps\BitConnect\Deps\BitApps\WPKit\Http\RequestType;
use BitApps\BitConnect\Deps\BitApps\WPKit\Http\Router\Router;
use BitApps\BitConnect\Enum\Taxonomies;
use BitApps\BitConnect\Http\RestPermission;
use BitApps\BitConnect\Services\AdminAccessService;
use BitApps\BitConnect\Services\AvatarService;
use BitApps\BitConnect\Services\FollowService;
use BitApps\BitConnect\Services\ForumUploadsInLibrary;
use BitApps\BitConnect\Services\MembersOnlyGuard;
use BitApps\BitConnect\Services\NotificationMailer;
use BitApps\BitConnect\Services\PortalLocation;
use BitApps\BitConnect\Services\PortalTaxonomies;
use BitApps\BitConnect\Services\ProfileSlugService;
use BitApps\BitConnect\Services\ReportService;
use BitApps\BitConnect\Services\StageHistoryService;
use BitApps\BitConnect\Services\TagApprovalService;
use BitApps\BitConnect\Services\TopicService;
use BitApps\BitConnect\Services\UserStatsService;
use BitApps\BitConnect\SSR\Seo\PortalSitemap;
use BitApps\BitConnect\SSR\Seo\SeoMeta;
use BitApps\BitConnect\SSR\Seo\SeoPluginBridge;
use BitApps\BitConnect\Views\PortalBlock;

class HookProvider
{
    private $_pluginBackend;

    public function __construct()
    {
        $this->_pluginBackend = Config::get('BASEDIR') . DIRECTORY_SEPARATOR;

        $this->loadAppShortcodes();

        new PostTypeProvider();

        Hooks::addAction('rest_api_init', [$this, 'loadAppApiHooks']);

        // A term whose slug is edited keeps its old archive URL as a redirect —
        // see PortalTaxonomies::renamedTermUrl().
        Hooks::addFilter('wp_update_term_data', [PortalTaxonomies::class, 'rememberPreviousSlug'], 10, 3);

        // A deleted tag takes its follows with it — see FollowService.
        Hooks::addAction('delete_term', [FollowService::class, 'onTermDeleted'], 10, 3);

        // Who suggested a tag, beside it in the admin's list — see TagApprovalService.
        Hooks::addFilter('rest_prepare_' . Taxonomies::TAGS->value, [TagApprovalService::class, 'restFields'], 10, 2);

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

        // A members-only forum stays closed on the routes core serves topics
        // through by itself — REST, feeds, search, taxonomy archives, oEmbed.
        MembersOnlyGuard::register();

        // What members upload in the forum stays out of the Media Library and
        // the media picker, under a "Bit Connect uploads" view of its own.
        ForumUploadsInLibrary::register();

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

        // Pending reports close when their topic or comment is deleted, from
        // the portal or from wp-admin.
        ReportService::registerHooks();

        // When a topic last moved stage, sent with each topic.
        // Global for the same reason: an admin moves topics from wp-admin.
        StageHistoryService::register();

        // Topic lists ordered by votes — see TopicService::voteOrderClauses().
        Hooks::addFilter('posts_clauses', [TopicService::class, 'voteOrderClauses'], 10, 2);

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

        // The portal as a block: found in the inserter under "Bit Connect",
        // and able to draw a preview of itself where a shortcode shows as text.
        // This provider runs on init, which is when blocks register.
        PortalBlock::register();

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
        $vars[] = 'bit_connect_token';
        // Confirmation link for an email change. Registered for the same reason
        // as bit_connect_token: WordPress strips unknown query vars, and the SPA reads
        // this one to know which flow the visitor arrived in.
        $vars[] = 'bit_connect_email_token';

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
        if (RequestType::is(RequestType::API)) {
            self::registerApiRoutes();
        }
    }

    /**
     * Registers the plugin's REST routes, once per request.
     *
     * A REST request does it on rest_api_init. A portal page does it too, when
     * it answers the app's first requests in the page itself — see
     * PortalPreload — and it is the same routes either way.
     */
    public static function registerApiRoutes(): void
    {
        static $registered = false;

        $file = Config::get('BASEDIR') . DIRECTORY_SEPARATOR . 'hooks' . DIRECTORY_SEPARATOR . 'api.php';

        if ($registered || !is_readable($file)) {
            return;
        }

        $registered = true;

        $router = new Router(RequestType::API, Config::SLUG, 'v1');

        include $file;
        $router->register();

        // Each route's permission_callback asks its Request's authorize().
        RestPermission::register();
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
