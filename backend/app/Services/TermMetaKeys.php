<?php

namespace BitApps\BitConnect\Services;

// Prevent direct script access
if (!defined('ABSPATH')) {
    exit;
}

use BitApps\BitConnect\Enum\Taxonomies;

/**
 * Carries the term meta this plugin writes over to its prefixed keys.
 *
 * The colour, icon, default flag and position on a topic type, department,
 * stage or status used to sit under bare keys — `color`, `icon_url`, `order`
 * and so on. Term meta is one shared table, so a bare key is a name any other
 * plugin could write to the same term. Every reader and writer now uses the
 * `bit_connect_` keys; this moves what existing sites already stored.
 *
 * Runs once, guarded by its own option, like the capability upgrades in
 * CapabilityService: a site that updates the plugin files in place never fires
 * the activation hook, so it is called from the request path instead.
 */
final class TermMetaKeys
{
    private const MIGRATION_OPTION = 'bit_connect_term_meta_prefixed_v1';

    /**
     * Bare key => prefixed key, for every term meta this plugin ever wrote.
     *
     * @return array<string, string>
     */
    public static function renames(): array
    {
        return [
            'color'         => 'bit_connect_color',
            'icon_url'      => 'bit_connect_icon_url',
            'icon_id'       => 'bit_connect_icon_id',
            'icon_dark_url' => 'bit_connect_icon_dark_url',
            'icon_dark_id'  => 'bit_connect_icon_dark_id',
            'is_default'    => 'bit_connect_is_default',
            'order'         => 'bit_connect_order',
        ];
    }

    /**
     * Move every stored value under its prefixed key and drop the bare one.
     *
     * A value already present under the new key wins: a term saved from the
     * admin after the update, before this ran, is not overwritten by whatever
     * the old key still held.
     *
     * @return int how many meta rows were moved
     */
    public static function migrate(): int
    {
        if (get_option(self::MIGRATION_OPTION)) {
            return 0;
        }

        $moved = 0;

        foreach (Taxonomies::cases() as $taxonomy) {
            $terms = get_terms(
                [
                    'taxonomy'   => $taxonomy->value,
                    'hide_empty' => false,
                ]
            );

            if (is_wp_error($terms) || !\is_array($terms)) {
                continue;
            }

            foreach ($terms as $term) {
                $termId = (int) (\is_object($term) ? $term->term_id : $term);

                if ($termId < 1) {
                    continue;
                }

                $moved += self::migrateTerm($termId);
            }
        }

        update_option(self::MIGRATION_OPTION, true);

        return $moved;
    }

    private static function migrateTerm(int $termId): int
    {
        $moved = 0;

        foreach (self::renames() as $bare => $prefixed) {
            $old = get_term_meta($termId, $bare, true);

            if ($old === '' || $old === null || $old === false) {
                continue;
            }

            $current = get_term_meta($termId, $prefixed, true);

            if ($current === '' || $current === null || $current === false) {
                update_term_meta($termId, $prefixed, $old);
            }

            delete_term_meta($termId, $bare);
            ++$moved;
        }

        return $moved;
    }
}
