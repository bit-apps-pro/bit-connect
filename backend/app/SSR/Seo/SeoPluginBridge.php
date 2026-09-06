<?php

namespace BitApps\BitConnect\SSR\Seo;

use BitApps\BitConnect\Deps\BitApps\WPKit\Hooks\Hooks;
use BitApps\BitConnect\Enum\SeoSettings;

if (!defined('ABSPATH')) {
    exit;
}

/**
 * Hands the matched portal route's metadata to whichever SEO plugin owns the head.
 *
 * Yoast, Rank Math, SEOPress and All in One SEO all describe the *portal page*,
 * because that is the only thing WordPress's main query tells them about — the
 * topic routes are served by the portal's own router and are invisible to them.
 * Left alone they stamp the portal page's title and, far worse, its canonical
 * onto every topic URL, collapsing the entire community to a single indexable
 * page while the sitemap advertises the topic URLs the canonical then disowns.
 *
 * Yielding to them is not an option either: they cannot describe a route they
 * cannot see. So instead of competing with the active plugin or standing aside
 * for it, this feeds it — the same values SeoMeta would have printed, pushed
 * through the plugin's own filters so it prints them in its own format. Site
 * owners keep one SEO plugin managing their whole site, and portal routes stop
 * being the hole in it.
 *
 * Every callback is a no-op unless a route described itself this request, so a
 * filter firing on a normal page or post passes its value straight through.
 */
final class SeoPluginBridge
{
    /**
     * Wire every supported plugin's filters.
     *
     * Registered unconditionally rather than behind a detection check: this runs
     * while plugins are still loading, so an SEO plugin that loads after this one
     * would not yet be detectable. A filter added for a plugin that is not
     * installed simply never fires, which costs nothing.
     */
    public static function register(): void
    {
        self::registerYoast();
        self::registerRankMath();
        self::registerSeoPress();
        self::registerAioseo();
    }

    /**
     * Whether an SEO plugin is printing this route's tags on our behalf.
     *
     * SeoMeta consults this to decide whether to print its own social tags —
     * exactly one component may own them. Detection runs at call time (during
     * `wp_head`), by which point every plugin is loaded.
     */
    public static function isBridged(): bool
    {
        $owner = SeoSettings::metaOwner();

        if ($owner === SeoSettings::OWNER_PLUGIN) {
            // Bit Connect prints the tags itself even where an SEO plugin is
            // installed. It still receives the route data through the filters
            // below, so if it prints anything of its own it is at least correct.
            $bridged = false;
        } elseif ($owner === SeoSettings::OWNER_SEO_PLUGIN) {
            // Hand the head over whether or not a supported plugin was detected.
            // For an unsupported one this means no route tags at all, which is
            // what "let my SEO plugin own this" asks for.
            $bridged = true;
        } else {
            $bridged = self::detect() !== '';
        }

        return (bool) Hooks::applyFilter('bit_connect_seo_plugin_bridge', $bridged);
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
     * Yoast SEO.
     */
    private static function registerYoast(): void
    {
        $map = [
            'wpseo_title'               => 'title',
            'wpseo_metadesc'            => 'description',
            'wpseo_canonical'           => 'canonical',
            'wpseo_opengraph_title'     => 'title',
            'wpseo_opengraph_desc'      => 'description',
            'wpseo_opengraph_url'       => 'canonical',
            'wpseo_opengraph_image'     => 'image',
            'wpseo_opengraph_type'      => 'type',
            'wpseo_twitter_title'       => 'title',
            'wpseo_twitter_description' => 'description',
            'wpseo_twitter_image'       => 'image',
        ];

        foreach ($map as $filter => $key) {
            Hooks::addFilter($filter, static fn ($value) => self::override($value, $key));
        }
    }

    /**
     * Rank Math.
     */
    private static function registerRankMath(): void
    {
        $map = [
            'rank_math/frontend/title'                        => 'title',
            'rank_math/frontend/description'                  => 'description',
            'rank_math/frontend/canonical'                    => 'canonical',
            'rank_math/opengraph/facebook/og_title'           => 'title',
            'rank_math/opengraph/facebook/og_description'     => 'description',
            'rank_math/opengraph/facebook/og_url'             => 'canonical',
            'rank_math/opengraph/facebook/og_image'           => 'image',
            'rank_math/opengraph/facebook/og_type'            => 'type',
            'rank_math/opengraph/twitter/twitter_title'       => 'title',
            'rank_math/opengraph/twitter/twitter_description' => 'description',
            'rank_math/opengraph/twitter/twitter_image'       => 'image',
        ];

        foreach ($map as $filter => $key) {
            Hooks::addFilter($filter, static fn ($value) => self::override($value, $key));
        }
    }

    /**
     * SEOPress.
     */
    private static function registerSeoPress(): void
    {
        $map = [
            'seopress_titles_title'              => 'title',
            'seopress_titles_desc'               => 'description',
            'seopress_titles_canonical'          => 'canonical',
            'seopress_social_og_title'           => 'title',
            'seopress_social_og_desc'            => 'description',
            'seopress_social_og_url'             => 'canonical',
            'seopress_social_og_thumb'           => 'image',
            'seopress_social_twitter_card_title' => 'title',
            'seopress_social_twitter_card_desc'  => 'description',
            'seopress_social_twitter_card_thumb' => 'image',
        ];

        foreach ($map as $filter => $key) {
            Hooks::addFilter($filter, static fn ($value) => self::override($value, $key));
        }
    }

    /**
     * All in One SEO.
     *
     * Its social tags arrive as one associative array per network rather than a
     * filter per tag, so those are patched key by key.
     */
    private static function registerAioseo(): void
    {
        $map = [
            'aioseo_title'         => 'title',
            'aioseo_description'   => 'description',
            'aioseo_canonical_url' => 'canonical',
        ];

        foreach ($map as $filter => $key) {
            Hooks::addFilter($filter, static fn ($value) => self::override($value, $key));
        }

        $facebook = [
            'og:title'       => 'title',
            'og:description' => 'description',
            'og:url'         => 'canonical',
            'og:image'       => 'image',
            'og:type'        => 'type',
        ];

        $twitter = [
            'twitter:title'       => 'title',
            'twitter:description' => 'description',
            'twitter:image'       => 'image',
        ];

        Hooks::addFilter('aioseo_facebook_tags', static fn ($tags) => self::overrideTagArray($tags, $facebook));
        Hooks::addFilter('aioseo_twitter_tags', static fn ($tags) => self::overrideTagArray($tags, $twitter));
    }

    /**
     * Replace a plugin's value with the route's, when there is one.
     *
     * An empty route value is not an override — a topic with no featured image
     * should fall back to whatever the site configured, not blank the tag.
     *
     * @param mixed $value
     *
     * @return mixed
     */
    private static function override($value, string $key)
    {
        $meta = SeoMeta::meta();

        if ($meta === null || !isset($meta[$key]) || $meta[$key] === '') {
            return $value;
        }

        return $meta[$key];
    }

    /**
     * Patch the keys we own inside a plugin's tag array, leaving the rest alone.
     *
     * Defensive by design: if a future version changes the shape, the array is
     * returned untouched rather than corrupted.
     *
     * @param mixed                 $tags
     * @param array<string, string> $map  tag name => meta key
     *
     * @return mixed
     */
    private static function overrideTagArray($tags, array $map)
    {
        if (!\is_array($tags) || SeoMeta::meta() === null) {
            return $tags;
        }

        foreach ($map as $tag => $key) {
            if (!\array_key_exists($tag, $tags)) {
                continue;
            }

            $tags[$tag] = self::override($tags[$tag], $key);
        }

        return $tags;
    }
}
