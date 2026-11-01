<?php

namespace BitApps\BitConnect\Views;

use BitApps\BitConnect\Config;
use BitApps\BitConnect\Deps\BitApps\WPKit\Hooks\Hooks;

if (!defined('ABSPATH')) {
    exit;
}

/**
 * Keeps the site's JS and CSS optimisers away from the portal's own scripts.
 *
 * The portal starts in a fixed order, and each step needs the one before it:
 *
 * 1. the import map, which tells the browser where `@wordpress/interactivity` is;
 * 2. the inline config, `window.bit_connect_`, which the bundle reads as it starts;
 * 3. the pre-paint and theme scripts, which must run before the first paint;
 * 4. the bundle itself, a `type="module"` script.
 *
 * An optimiser that delays scripts until the visitor moves the mouse (WP Rocket,
 * LiteSpeed, Perfmatters, FlyingPress) left the loading dots up until then, or
 * ran the bundle before its config and stopped it. One that combines inline
 * scripts or moves them to the footer (LiteSpeed, Autoptimize, SiteGround), or
 * Cloudflare's Rocket Loader, broke the order. One that removes "unused" CSS
 * removed all of it: the portal draws its markup in the browser, so the page the
 * optimiser reads uses none of the portal's classes.
 *
 * So each of the four is marked with the attributes those tools read, and each
 * tool's exclusion filter is given the same scripts and the portal's stylesheet.
 * Only on the requests that draw the portal; everything else on the site is
 * optimised as before.
 */
final class OptimizerExclusions
{
    /**
     * The attributes the optimisers read. `data-cfasync` is first: Rocket
     * Loader reads it only before `src`.
     */
    private const ATTRIBUTES = [
        'data-cfasync'            => 'false',
        'data-no-optimize'        => '1',
        'data-no-defer'           => '1',
        'data-no-minify'          => '1',
        'data-noptimize'          => '1',
        'data-pagespeed-no-defer' => true,
        'nowprocket'              => true,
    ];

    /** Text only the portal's inline scripts carry, for the filters that match on it. */
    private const INLINE_MARKERS = ['window["bit_connect_"]', '"bc-js"', 'bit-connect-config'];

    private static ?bool $active = null;

    public static function register(): void
    {
        Hooks::addFilter('wp_script_attributes', [self::class, 'markScript']);
        Hooks::addFilter('wp_inline_script_attributes', [self::class, 'markScript']);

        // WP Rocket.
        Hooks::addFilter('rocket_delay_js_exclusions', [self::class, 'addPatterns']);
        Hooks::addFilter('rocket_exclude_defer_js', [self::class, 'addPatterns']);
        Hooks::addFilter('rocket_exclude_js', [self::class, 'addPatterns']);
        Hooks::addFilter('rocket_excluded_inline_js_content', [self::class, 'addInlineMarkers']);
        Hooks::addFilter('rocket_rucss_safelist', [self::class, 'addStylesheet']);

        // LiteSpeed Cache.
        Hooks::addFilter('litespeed_optimize_js_excludes', [self::class, 'addPatterns']);
        Hooks::addFilter('litespeed_optm_js_defer_exc', [self::class, 'addPatterns']);
        Hooks::addFilter('litespeed_optm_gm_js_exc', [self::class, 'addPatterns']);
        Hooks::addFilter('litespeed_optimize_ucss_file_exc_inline', [self::class, 'addStylesheet']);

        // Autoptimize: comma-separated strings, not lists.
        Hooks::addFilter('autoptimize_filter_js_exclude', [self::class, 'addPatternsToString']);
        Hooks::addFilter('autoptimize_filter_css_exclude', [self::class, 'addStylesheetToString']);

        // SiteGround Optimizer: by handle, and by inline content.
        Hooks::addFilter('sgo_javascript_combine_exclude', [self::class, 'addHandles']);
        Hooks::addFilter('sgo_js_minify_exclude', [self::class, 'addHandles']);
        Hooks::addFilter('sgo_js_async_exclude', [self::class, 'addHandles']);
        Hooks::addFilter('sgo_javascript_combine_excluded_inline_content', [self::class, 'addInlineMarkers']);
    }

    /**
     * Adds the optimisers' attributes to one of the portal's script tags.
     *
     * @param mixed $attributes
     *
     * @return mixed
     */
    public static function markScript($attributes)
    {
        if (!\is_array($attributes) || !\is_string($attributes['id'] ?? null) || !self::isActive()) {
            return $attributes;
        }

        if (!self::isPortalScript($attributes['id'])) {
            return $attributes;
        }

        return self::ATTRIBUTES + $attributes;
    }

    /**
     * @param mixed $patterns
     *
     * @return mixed
     */
    public static function addPatterns($patterns)
    {
        if (!\is_array($patterns) || !self::isActive()) {
            return $patterns;
        }

        return array_merge($patterns, self::scriptPatterns());
    }

    /**
     * @param mixed $patterns
     *
     * @return mixed
     */
    public static function addInlineMarkers($patterns)
    {
        if (!\is_array($patterns) || !self::isActive()) {
            return $patterns;
        }

        return array_merge($patterns, self::INLINE_MARKERS);
    }

    /**
     * @param mixed $handles
     *
     * @return mixed
     */
    public static function addHandles($handles)
    {
        if (!\is_array($handles) || !self::isActive()) {
            return $handles;
        }

        return array_merge($handles, self::handles());
    }

    /**
     * @param mixed $patterns
     *
     * @return mixed
     */
    public static function addStylesheet($patterns)
    {
        if (!\is_array($patterns) || !self::isActive()) {
            return $patterns;
        }

        $patterns[] = self::assetPath();

        return $patterns;
    }

    /**
     * @param mixed $list
     *
     * @return mixed
     */
    public static function addPatternsToString($list)
    {
        if (!\is_string($list) || !self::isActive()) {
            return $list;
        }

        return self::appendToList($list, array_merge(self::scriptPatterns(), self::INLINE_MARKERS));
    }

    /**
     * @param mixed $list
     *
     * @return mixed
     */
    public static function addStylesheetToString($list)
    {
        if (!\is_string($list) || !self::isActive()) {
            return $list;
        }

        return self::appendToList($list, [self::assetPath()]);
    }

    /**
     * Whether this request draws the portal. BaseView::rendersPortal() is
     * settled on template_redirect; the tags and the optimisers' own passes
     * over the page come after it. A filter read before then gets false, and
     * that answer is not kept.
     */
    private static function isActive(): bool
    {
        if (self::$active !== null) {
            return self::$active;
        }

        if (is_admin() || !did_action('template_redirect')) {
            return false;
        }

        return self::$active = BaseView::rendersPortal();
    }

    private static function isPortalScript(string $id): bool
    {
        if ($id === 'wp-importmap') {
            return true;
        }

        foreach (self::handles() as $handle) {
            if (str_starts_with($id, $handle . '-js')) {
                return true;
            }
        }

        return false;
    }

    /**
     * The portal's script handles: the config, the pre-paint toggle, the bundle.
     *
     * @return string[]
     */
    private static function handles(): array
    {
        $slug = Config::SLUG . '-sc';

        return [$slug . '-module-config', PrePaint::handle(), $slug . '-MODULE-main'];
    }

    /**
     * What the URL- and ID-matching filters look for.
     *
     * @return string[]
     */
    private static function scriptPatterns(): array
    {
        return array_merge([self::assetPath(), 'wp-importmap', '@wordpress/interactivity'], self::handles());
    }

    /**
     * The path the bundle and its stylesheet are served under. The add-on's
     * bundle, when it is in use, is under its own folder; this follows it.
     */
    private static function assetPath(): string
    {
        return (string) wp_parse_url((string) Config::get('ASSET_URI'), PHP_URL_PATH);
    }

    /**
     * @param string[] $items
     */
    private static function appendToList(string $list, array $items): string
    {
        $list = trim($list);

        return ($list === '' ? '' : rtrim($list, ', ') . ', ') . implode(', ', $items);
    }
}
