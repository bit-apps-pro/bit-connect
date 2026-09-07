<?php

namespace BitApps\BitConnect\Views;

use BitApps\BitConnect\Config;

if (!defined('ABSPATH')) {
    exit;
}

/**
 * Everything the portal needs styled and switched before its bundle mounts.
 *
 * Three things have to be true at first paint, and none of them can wait for
 * the JS bundle:
 *
 * - the server-rendered markup must not arrive unstyled (in dev every
 *   stylesheet comes through the bundle, and even the production CSS can lag
 *   the HTML);
 * - a client that runs JS must see the loading spinner rather than the crawler
 *   view, which means a class on `<html>` before the browser paints;
 * - the spinner must animate, which means its keyframes are on the page before
 *   the markup that references them.
 *
 * All three used to be raw `<style>`/`<script>` tags — two of them printed from
 * `SeoMeta::head()`, and the keyframes duplicated inline in both loading
 * templates. They go through `wp_add_inline_style()`/`wp_add_inline_script()`
 * now, on a src-less handle enqueued from `wp_enqueue_scripts`, which is what
 * the plugin directory guidelines ask for and what the rest of this plugin
 * already does for its config payload and `ThemeBoot`.
 *
 * Timing is unchanged in the way that matters: styles print at `wp_head`
 * priority 8 and head scripts at 9, both still ahead of `<body>` and so ahead
 * of the first paint. The handle is deliberately its own rather than folded
 * into BaseView's config script, which is enqueued on every front-end request —
 * `bc-js` on `<html>` would then leak onto pages this plugin does not render.
 *
 * Kept in lockstep with the markup that depends on it: `.bc-ssr` wraps the
 * crawler view (`SeoContent`), `.bc-ssr-loading` the human one, and `bc-dot`
 * is the spinner in `ShortCode::render()` and `SSRView::getDefaultContent()`.
 */
final class PrePaint
{
    /**
     * The shared style/script handle. One name for both, which WordPress keeps
     * in separate registries.
     */
    public static function handle(): string
    {
        return Config::SLUG . '-pre-paint';
    }

    /**
     * Register and enqueue the pre-paint CSS and JS for this request.
     *
     * Callers gate this: it belongs on requests that render the portal and on
     * no others. Idempotent, because more than one owner can ask.
     */
    public static function enqueue(): void
    {
        $handle = self::handle();

        if (wp_style_is($handle, 'enqueued')) {
            return;
        }

        wp_register_style($handle, false, [], Config::VERSION);
        wp_enqueue_style($handle);
        wp_add_inline_style($handle, self::css());

        wp_register_script($handle, false, [], Config::VERSION, ['in_footer' => false]);
        wp_enqueue_script($handle);
        wp_add_inline_script($handle, self::script());
    }

    /**
     * Minimal styles for the pre-mount first paint.
     *
     * ~1 KB, scoped under `.bc-ssr`, values matched to the Tailwind theme. After
     * React mounts no `.bc-ssr` element exists, so the rules match nothing.
     */
    public static function css(): string
    {
        // phpcs:disable Generic.Files.LineLength -- Minified CSS cannot be wrapped
        return <<<'CSS'
.bc-ssr{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;max-width:960px;margin:0 auto;padding:1rem;color:#374151;line-height:1.5}
.bc-ssr h1{font-size:1.25rem;font-weight:600;margin:0 0 1rem}
.bc-ssr ul{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:.75rem}
.bc-ssr li,.bc-ssr>article{border:1px solid #e5e7eb;border-radius:.5625rem;padding:.75rem}
.bc-ssr h2{font-size:1rem;font-weight:600;margin:0;line-height:1.375}
.bc-ssr a{color:#3266EA;text-decoration:none}
.bc-ssr p{margin:.25rem 0 0}
.bc-ssr li p{font-size:.875rem}
.bc-ssr time,.bc-ssr li p:last-child,.bc-ssr>article>p:first-of-type{color:#6b7280;font-size:.8125rem}
.bc-ssr section h2{margin-bottom:.5rem}
.bc-ssr-loading{display:none}
.bc-js .bc-ssr-loading{display:block}
.bc-js .bc-ssr{display:none}
@keyframes bc-dot{0%,100%{opacity:.4;transform:scale(.7)}50%{opacity:1;transform:scale(1.2)}}
CSS;
        // phpcs:enable Generic.Files.LineLength
    }

    /**
     * The pre-paint view toggle.
     *
     * Flips the body markup from the crawler view (content) to the human view
     * (loading spinner) — see the `.bc-js` rules in css(). The timeout is a
     * safety valve: if the app bundle never mounts, the content is re-revealed
     * rather than leaving the visitor on an endless spinner. Once React mounts,
     * the `.bc-ssr` subtree no longer exists and removing the class is a no-op.
     */
    public static function script(): string
    {
        // phpcs:disable Generic.Files.LineLength -- Minified JS cannot be wrapped
        return <<<'JS'
document.documentElement.classList.add("bc-js");setTimeout(function(){document.documentElement.classList.remove("bc-js")},8000);
JS;
        // phpcs:enable Generic.Files.LineLength
    }
}
