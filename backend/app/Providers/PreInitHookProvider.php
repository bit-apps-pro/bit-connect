<?php

namespace BitApps\BitConnect\Providers;

if (!\defined('ABSPATH')) {
    exit;
}

use BitApps\BitConnect\Config;
use BitApps\BitConnect\Deps\BitApps\WPKit\Hooks\Hooks;
use BitApps\BitConnect\Deps\BitApps\WPKit\Http\Router\StaticRouter;
use BitApps\BitConnect\Services\PortalLocation;
use BitApps\BitConnect\Services\PortalTaxonomies;
use BitApps\BitConnect\Services\RootRouter;
use WP_Post;

class PreInitHookProvider
{
    /**
     * Query var carrying the member id out of the profile rewrite.
     */
    private const PROFILE_QUERY_VAR = 'bit_connect_user';

    private $_pluginBackend;

    public function __construct()
    {
        $this->_pluginBackend = Config::get('BASEDIR') . DIRECTORY_SEPARATOR;
        $this->loadAppStaticRoutes();
        Hooks::addFilter('page_template', [$this, 'loadPortalTemplate'], 99, 1);
        Hooks::addAction('theme_switch', [$this, 'handleThemeSwitch']);
        // Priority 11: StaticRouter registers its own rules on `init` at the
        // default 10, and this has to be able to see the result.
        Hooks::addAction('init', [$this, 'registerProfileRewrite'], 11);
        Hooks::addAction('init', [$this, 'registerArchiveRewrite'], 11);
        Hooks::addFilter('query_vars', [$this, 'addProfileQueryVar']);
    }

    /**
     * Route `/{portal}/user/{id}` to the portal page.
     *
     * StaticRouter cannot express this itself: processRoutes() walks every
     * declared route, but makeRewriteRuleForPath() resets its rule array on
     * each call, so only the last route in hooks/static.php ends up with
     * rewrite rules — today that is `/{slug}`, whose single-segment pattern
     * cannot match a two-segment profile URL. Its request *matching* is fine,
     * so the route still dispatches once WordPress resolves the page; only the
     * rewrite needs supplying here.
     */
    public function registerProfileRewrite()
    {
        // Root mode claims /user/{id} on the 404 instead; a slug-scoped rule
        // would only publish a duplicate URL for the same profile.
        if (PortalLocation::isRoot()) {
            return;
        }

        $slug = trim((string) Config::getOption('portal_page', ''), '/');

        if ($slug === '') {
            return;
        }

        $regex = '^' . $slug . '/user/([^/]+)/?$';

        // 'top' so it is tested before the portal's own `^{slug}/([^/]+)/?$`
        // catch-all rather than after it.
        add_rewrite_rule(
            $regex,
            'index.php?pagename=' . $slug . '&' . self::PROFILE_QUERY_VAR . '=$matches[1]',
            'top'
        );

        // Persist once. Rewrite rules live in an option, so a rule added at
        // runtime is inert until flushed — but flushing on every request is
        // expensive, hence the check against what is already stored.
        $stored = get_option('rewrite_rules');

        if (\is_array($stored) && !isset($stored[$regex])) {
            flush_rewrite_rules(false);
        }
    }

    /**
     * Route `/{portal}/{segment}/{term}` to the portal page.
     *
     * Same shape and same reason as the profile rewrite above: the portal's own
     * `^{slug}/([^/]+)/?$` rule is single-segment and cannot match a two-segment
     * archive URL, so without this every term archive 404s before the app boots.
     *
     * The segment alternation is deliberately narrow rather than `([^/]+)` —
     * that would claim every two-segment URL under the portal, including ones a
     * future route may want.
     */
    public function registerArchiveRewrite()
    {
        // Root mode claims archives on the 404 instead; a slug-scoped rule would
        // only publish a duplicate URL for the same archive.
        if (PortalLocation::isRoot()) {
            return;
        }

        $slug = trim((string) Config::getOption('portal_page', ''), '/');

        if ($slug === '') {
            return;
        }

        $rules = [
            // Term archives.
            '^' . $slug . '/(' . PortalTaxonomies::segmentPattern() . ')/([^/]+)/?$',
            // Deeper pages of the list.
            '^' . $slug . '/page/([0-9]+)/?$',
        ];

        $missing = false;
        $stored = get_option('rewrite_rules');

        foreach ($rules as $regex) {
            // 'top' so these are tested before the portal's own single-segment
            // catch-all rather than after it.
            add_rewrite_rule($regex, 'index.php?pagename=' . $slug, 'top');

            if (\is_array($stored) && !isset($stored[$regex])) {
                $missing = true;
            }
        }

        if ($missing) {
            flush_rewrite_rules(false);
        }
    }

    /**
     * Allow the member id through WordPress's query var allow-list.
     *
     * @param array $vars
     *
     * @return array
     */
    public function addProfileQueryVar($vars)
    {
        $vars[] = self::PROFILE_QUERY_VAR;

        return $vars;
    }

    /**
     * Serve the portal template for the portal page under a classic theme.
     *
     * Block themes resolve the template through the `bit-connect-portal`
     * wp_template instead, and pages carrying the `_wp_page_template` meta are
     * already handled by HookProvider's `template_include` filter — this covers
     * the portal page when that meta is missing.
     *
     * @param string $pageTemplate
     *
     * @return string
     */
    public function loadPortalTemplate($pageTemplate)
    {
        global $post;

        $portalSlug = (string) Config::getOption('portal_page', '');
        $isBlockTheme = \function_exists('wp_is_block_theme') && wp_is_block_theme();

        if ($isBlockTheme || $portalSlug === '' || !($post instanceof WP_Post) || $post->post_name !== $portalSlug) {
            return $pageTemplate;
        }

        $customTemplate = Config::get('ROOT_DIR') . 'templates/portal-template.php';

        return file_exists($customTemplate) ? $customTemplate : $pageTemplate;
    }

    public function handleThemeSwitch()
    {
        $hasTemplates = get_posts(
            [
                'name'        => 'bit-connect-portal',
                'numberposts' => 1,
                'post_type'   => 'wp_template',
                'post_status' => 'any',
            ]
        );
        if (\count($hasTemplates) > 0) {
            wp_set_post_terms($hasTemplates[0]->ID, [get_stylesheet()], 'wp_theme');
        }
    }

    /**
     * Load static routes that use WordPress rewrite rules.
     */
    protected function loadAppStaticRoutes()
    {
        // Root mode routes on the 404 instead of on rewrites, so StaticRouter's
        // slug-scoped rules would only add a second, duplicate URL for every
        // topic. The two placements are mutually exclusive.
        if (PortalLocation::isServingAtRoot()) {
            new RootRouter();

            return;
        }

        // Root mode switched on but not front-page bound: fall through to the
        // slug router so the portal keeps working on its slug, and say why.
        if (PortalLocation::isRoot()) {
            RootRouter::registerFrontPageNotice();
        }

        if (is_readable($this->_pluginBackend . 'hooks' . DIRECTORY_SEPARATOR . 'static.php') && ($portalPage = Config::getOption('portal_page', false)) !== false) {
            $router = new StaticRouter($portalPage, Config::withPrefix('activate'), Config::withPrefix('deactivate'));
            $router->loadRoutesFromFile(
                $this->_pluginBackend . 'hooks' . DIRECTORY_SEPARATOR . 'static.php'
            );
        }
    }
}
