<?php

namespace BitApps\BitConnect\Views;

use BitApps\BitConnect\Config;

if (!\defined('ABSPATH')) {
    exit;
}

/**
 * Applies the visitor's stored theme before the first paint.
 *
 * The theme is a per-visitor localStorage value, so the server cannot know it
 * and the HTML it sends is always the light one. Without this, everyone on dark
 * gets a full-page white flash for as long as the bundle takes to download,
 * parse, mount and run its first layout effect — on a cold cache over mobile,
 * comfortably long enough to be the first thing they notice.
 *
 * It has to be inline and synchronous in the head for exactly that reason: an
 * external or deferred script runs after the paint it exists to prevent. It is
 * attached to the same inline config script both the admin panel and the portal
 * already print there, so it appears on precisely the requests that load the
 * app and on no others — a class on `<html>` would otherwise leak into pages
 * this plugin does not render.
 *
 * Kept in lockstep with `@shared/theme/theme-mode.ts`: the storage key, the
 * `themeMode` field, the legacy `isDarkTheme` fallback and the `dark` class are
 * one contract, read on the other side by `readStoredMode()`.
 */
final class ThemeBoot
{
    /**
     * The pre-paint theme script, ready to hand to wp_add_inline_script().
     */
    public static function script(): string
    {
        // Notes on the JS, which is minified past commenting:
        // - color-scheme is set as well as the class because the *browser* keys
        //   off it — without it form controls, scrollbars and the canvas behind
        //   the page stay light, the white gaps no stylesheet reaches.
        // - the catch swallows a quota-blocked, disabled or partitioned
        //   localStorage, which throws on read. Light is what the server markup
        //   is styled for, so failing closed costs a flash at worst.
        $template = <<<'JS'
(function(){try{
var m="system",r=localStorage.getItem(%s);
if(r){var v=JSON.parse(r);
if(v&&(v.themeMode==="dark"||v.themeMode==="light"||v.themeMode==="system")){m=v.themeMode;}
else if(v&&typeof v.isDarkTheme==="boolean"){m=v.isDarkTheme?"dark":"light";}}
var d=m==="dark"||(m==="system"&&!!window.matchMedia&&window.matchMedia("(prefers-color-scheme: dark)").matches);
document.documentElement.classList.toggle("dark",d);
document.documentElement.style.colorScheme=d?"dark":"light";
}catch(e){}})();
JS;

        // Config::SLUG is the same value the frontend reads as `pluginSlug`, and
        // the config atom keys its blob `${pluginSlug}-config`.
        return \sprintf($template, wp_json_encode(Config::SLUG . '-config'));
    }
}
