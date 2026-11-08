<?php

namespace BitApps\BitConnect\Services;

use BitApps\BitConnect\Config;

// Prevent direct script access
if (!defined('ABSPATH')) {
    exit;
}

/**
 * The translated interface strings both bundles read from `translations`.
 *
 * The admin app and the portal call `__()` in the browser, which looks the
 * text up in the page's `translations` map. Both payloads — Head for the
 * admin, BaseView for the portal — hand their map over here, so neither can
 * ship without it again.
 */
final class FrontendTranslations
{
    /**
     * Add the plugin's translated strings to a config payload.
     *
     * `backend/i18n/`, not `languages/`. The catalogue is plugin source — a
     * generated list of `__()` calls that `wp i18n make-pot` reads and that
     * this method executes to get the translations. It is not a compiled
     * translation, and a `.php` sitting in `languages/` reads as one to the
     * directory's scanners.
     *
     * Merged, not assigned: a `bit_connect_localized_script` listener may
     * already have added the strings of a bundle it extends this one with, and
     * assigning would throw them away. English needs no map.
     *
     * @param array $vars the payload, after its filter ran
     *
     * @return array
     */
    public static function merge(array $vars)
    {
        $catalogue = Config::get('ROOT_DIR') . '/backend/i18n/frontend-strings.php';

        if (get_locale() === 'en_US' || !file_exists($catalogue)) {
            return $vars;
        }

        $vars['translations'] = array_merge(
            (array) include $catalogue,
            \is_array($vars['translations'] ?? null) ? $vars['translations'] : []
        );

        return $vars;
    }
}
