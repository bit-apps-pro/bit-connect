<?php

namespace BitApps\BitConnect\Enum;

// Prevent direct script access
if (!defined('ABSPATH')) {
    exit;
}

enum GeneralSettings: string
{
    case OPTION_NAME = 'general_settings';

    /**
     * Visibility of the portal topic-list filter controls, normalised for the
     * frontend config variable.
     *
     * Each control is visible unless an admin explicitly switched it off, so an
     * option saved before this setting existed keeps its full filter toolbar.
     *
     * @param mixed $settings the stored general_settings option
     */
    public static function portalFilters($settings): array
    {
        $stored = \is_array($settings) ? $settings : [];
        $filters = \is_array($stored['portalFilters'] ?? null) ? $stored['portalFilters'] : [];

        return [
            'sort' => !isset($filters['sort']) || (bool) $filters['sort'],
            'tags' => !isset($filters['tags']) || (bool) $filters['tags'],
        ];
    }

    /**
     * The Bit Apps credit card at the foot of the portal sidebar: whether it
     * shows, and what it says.
     *
     * `enabled` defaults to off, the opposite of portalFilters() above: this one
     * puts a link to another site on pages the owner published, so it only
     * appears where an admin deliberately switched it on.
     *
     * The switch is the only stored part. The copy is the plugin's own, fixed
     * and translatable, so switching the card on is the whole decision — any
     * wording an older version stored is ignored.
     *
     * @param mixed $settings the stored general_settings option
     *
     * @return array{enabled: bool, url: string, eyebrow: string, headline: string, prefix: string, phrases: array<int, string>, cta: string}
     */
    public static function promo($settings): array
    {
        $stored = \is_array($settings) ? $settings : [];
        $promo = \is_array($stored['promo'] ?? null) ? $stored['promo'] : [];

        return [
            'enabled'  => filter_var($promo['enabled'] ?? false, FILTER_VALIDATE_BOOLEAN),
            'url'      => 'https://bitapps.pro',
            'eyebrow'  => __('a Bit Apps product', 'bit-connect'),
            'headline' => __('Built with Bit Connect', 'bit-connect'),
            'prefix'   => __('We also build', 'bit-connect'),
            'phrases'  => [
                __('smart WordPress forms', 'bit-connect'),
                __('no-code automations', 'bit-connect'),
                __('communities like this', 'bit-connect'),
            ],
            'cta' => __('Explore our plugins', 'bit-connect'),
        ];
    }
}
