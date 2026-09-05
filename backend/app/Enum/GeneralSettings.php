<?php

namespace BitApps\BitConnect\Enum;

// Prevent direct script access
if (!\defined('ABSPATH')) {
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
            'sort'    => !isset($filters['sort']) || (bool) $filters['sort'],
            'product' => !isset($filters['product']) || (bool) $filters['product'],
            'tags'    => !isset($filters['tags']) || (bool) $filters['tags'],
        ];
    }

    /**
     * The promo card at the foot of the portal sidebar: whether it shows, where
     * it points, and every word on it.
     *
     * `enabled` defaults to off, the opposite of portalFilters() above: this one
     * puts a link to another site on pages the owner published, so it only
     * appears where an admin deliberately switched it on.
     *
     * Every line defaults to empty, and the portal renders no copy of its own to
     * fill the gap — an empty line is a row the card does not have, and a card
     * with nothing written in it does not render.
     *
     * @param mixed $settings the stored general_settings option
     *
     * @return array{enabled: bool, url: string, eyebrow: string, headline: string, prefix: string, phrases: array<int, string>, cta: string}
     */
    public static function promo($settings): array
    {
        $stored = \is_array($settings) ? $settings : [];
        $promo = \is_array($stored['promo'] ?? null) ? $stored['promo'] : [];
        $phrases = \is_array($promo['phrases'] ?? null) ? $promo['phrases'] : [];
        $strings = array_map(static fn ($phrase) => \is_string($phrase) ? $phrase : '', $phrases);
        $filled = array_filter($strings, static fn (string $phrase) => $phrase !== '');

        return [
            'enabled'  => filter_var($promo['enabled'] ?? false, FILTER_VALIDATE_BOOLEAN),
            'url'      => self::promoText($promo, 'url'),
            'eyebrow'  => self::promoText($promo, 'eyebrow'),
            'headline' => self::promoText($promo, 'headline'),
            'prefix'   => self::promoText($promo, 'prefix'),
            'phrases'  => array_values($filled),
            'cta'      => self::promoText($promo, 'cta'),
        ];
    }

    /**
     * One stored line of promo copy, or '' for anything that is not a string.
     *
     * @param array<string, mixed> $promo
     */
    private static function promoText(array $promo, string $key): string
    {
        return \is_string($promo[$key] ?? null) ? $promo[$key] : '';
    }
}
