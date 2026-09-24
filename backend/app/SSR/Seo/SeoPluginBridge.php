<?php

namespace BitApps\BitConnect\SSR\Seo;

use BitApps\BitConnect\Deps\BitApps\WPKit\Hooks\Hooks;

if (!defined('ABSPATH')) {
    exit;
}

/**
 * Stands the site's SEO plugin down on portal routes, keeping only its title.
 *
 * Yoast, Rank Math, SEOPress and All in One SEO all describe the *portal page*,
 * because that is the only thing WordPress's main query tells them about — the
 * topic routes are served by the portal's own router and are invisible to them.
 * Left alone they stamp the portal page's canonical, robots, social tags and
 * schema graph onto every topic URL, collapsing the community into one
 * indexable page while the sitemap advertises the URLs that canonical disowns.
 *
 * Feeding them the route's values through their own filters was tried and
 * could not be made whole: SEOPress's social and canonical filters carry
 * complete HTML tags rather than values, an image the portal page lacks is
 * never offered for replacement, robots and the JSON-LD graph are built from
 * the page and not from any filter, and a route with no canonical of its own
 * inherits the page's. So on a route SeoMeta has described, the plugin prints
 * nothing but the document title — fed the route's — and SeoMeta prints the
 * rest. Everywhere else the plugin runs untouched, and site verification tags
 * survive on every page, since a portal served at the site root is the front
 * page Search Console checks.
 *
 * `bit_connect_seo_plugin_stand_down` returns false to leave the plugin's own
 * output in place; SeoMeta's tags then print alongside it unless
 * `bit_connect_seo_social_tags` silences them.
 */
final class SeoPluginBridge
{
    /**
     * Wire every supported plugin's hooks.
     *
     * Registered unconditionally rather than behind a detection check: this runs
     * while plugins are still loading, so an SEO plugin that loads after this one
     * would not yet be detectable. A hook added for a plugin that is not
     * installed simply never fires, which costs nothing.
     */
    public static function register(): void
    {
        // The title is the one thing each plugin keeps printing, so it is the
        // one value it is fed. SEOPress needs no feed: its title is unhooked
        // below, and WordPress's own title carries SeoMeta's.
        foreach (['wpseo_title', 'rank_math/frontend/title', 'aioseo_title'] as $filter) {
            Hooks::addFilter($filter, [self::class, 'title']);
        }

        self::registerYoast();
        self::registerAioseo();

        // Rank Math prints everything from its own `rank_math/head` action and
        // SEOPress from two `wp_head` callbacks at priority 0; both are
        // unhooked here, ahead of either.
        Hooks::addAction('wp_head', [self::class, 'standDownHeadOutput'], -1);

        // SEOPress's newer title and description classes defer to the legacy
        // path unhooked above whenever these answer true.
        Hooks::addFilter('seopress_old_pre_get_document_title', [self::class, 'keepTrueOnRoute']);
        Hooks::addFilter('seopress_old_wp_head_description', [self::class, 'keepTrueOnRoute']);
    }

    /**
     * Whether the SEO plugin stands down for this request.
     *
     * Only on a route SeoMeta described: a normal page or post belongs to the
     * plugin entirely.
     */
    public static function standsDown(): bool
    {
        if (SeoMeta::meta() === null) {
            return false;
        }

        return (bool) Hooks::applyFilter('bit_connect_seo_plugin_stand_down', true);
    }

    /**
     * Which supported SEO plugin is active, or an empty string for none.
     */
    public static function detect(): string
    {
        if (defined('WPSEO_VERSION')) {
            return 'yoast';
        }

        if (class_exists('RankMath')) {
            return 'rankmath';
        }

        if (defined('SEOPRESS_VERSION')) {
            return 'seopress';
        }

        if (\function_exists('aioseo')) {
            return 'aioseo';
        }

        return '';
    }

    /**
     * The route's title in place of the plugin's, when a route has one.
     *
     * @param mixed $value
     *
     * @return mixed
     */
    public static function title($value)
    {
        $meta = SeoMeta::meta();

        if ($meta === null || empty($meta['title'])) {
            return $value;
        }

        return $meta['title'];
    }

    /**
     * Unhook Rank Math's and SEOPress's head output on a portal route.
     *
     * Runs on `wp_head` at priority -1, before Rank Math's action fires at 1 and
     * SEOPress's loaders at 0.
     */
    public static function standDownHeadOutput(): void
    {
        if (!self::standsDown()) {
            return;
        }

        // Rank Math moved core's title tag into its own action, so emptying the
        // action would take the title with it. Put that one back. Its
        // verification tags are added to the action at `wp_head` priority 0 —
        // after this — so they survive.
        if (class_exists('RankMath')) {
            remove_all_actions('rank_math/head');
            add_action('rank_math/head', '_wp_render_title_tag', 1);
        }

        // Verification and analytics are separate callbacks at later
        // priorities and are left in place.
        remove_action('wp_head', 'seopress_load_titles_options', 0);
        remove_action('wp_head', 'seopress_load_social_options', 0);
    }

    /**
     * @param mixed $value
     *
     * @return mixed
     */
    public static function keepTrueOnRoute($value)
    {
        return self::standsDown() ? true : $value;
    }

    /**
     * Yoast's head output, down to its title and verification tags.
     *
     * @param mixed $presenters
     *
     * @return mixed
     */
    public static function yoastPresenters($presenters)
    {
        if (!\is_array($presenters) || !self::standsDown()) {
            return $presenters;
        }

        return array_values(array_filter($presenters, static function ($presenter) {
            if (!\is_object($presenter)) {
                return false;
            }

            $class = \get_class($presenter);

            // Removing the title presenter would leave no <title> at all: Yoast
            // has already unhooked core's.
            // Matched by name: Yoast's classes are not loaded on every site. The
            // Open Graph and Twitter title presenters end in `\Open_Graph\…`
            // and `\Twitter\…`, so only the document title matches this.
            return str_ends_with($class, '\Presenters\Title_Presenter')
                || str_contains($class, '\Presenters\Webmaster\\')
                || str_contains($class, '\Presenters\Debug\\');
        }));
    }

    /**
     * All in One SEO's head output, down to its verification tags.
     *
     * Its social and schema views go entirely. The meta view also carries the
     * site verification tags, so it stays, with every route-describing value
     * in it blanked — each of which it omits when empty.
     *
     * @param mixed $views
     *
     * @return mixed
     */
    public static function aioseoViews($views)
    {
        if (!\is_array($views) || !self::standsDown()) {
            return $views;
        }

        unset($views['social'], $views['schema']);

        return $views;
    }

    /**
     * @param mixed $value
     *
     * @return mixed
     */
    public static function blankOnRoute($value)
    {
        return self::standsDown() ? '' : $value;
    }

    /**
     * @param mixed $value
     *
     * @return mixed
     */
    public static function emptyArrayOnRoute($value)
    {
        return self::standsDown() ? [] : $value;
    }

    /**
     * Yoast SEO.
     *
     * Its robots values are merged into core's `wp_robots` output by a separate
     * integration, outside the presenters, so they are emptied on their own.
     */
    private static function registerYoast(): void
    {
        Hooks::addFilter('wpseo_frontend_presenters', [self::class, 'yoastPresenters']);
        Hooks::addFilter('wpseo_robots_array', [self::class, 'emptyArrayOnRoute']);
    }

    /**
     * All in One SEO.
     */
    private static function registerAioseo(): void
    {
        Hooks::addFilter('aioseo_meta_views', [self::class, 'aioseoViews']);

        foreach (['aioseo_description', 'aioseo_canonical_url', 'aioseo_prev_link', 'aioseo_next_link'] as $filter) {
            Hooks::addFilter($filter, [self::class, 'blankOnRoute']);
        }

        Hooks::addFilter('aioseo_robots_meta', [self::class, 'emptyArrayOnRoute']);
    }
}
