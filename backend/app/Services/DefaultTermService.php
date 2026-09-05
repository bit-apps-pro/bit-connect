<?php

declare(strict_types=1);

namespace BitApps\BitConnect\Services;

// Prevent direct script access
if (!\defined('ABSPATH')) {
    exit;
}

use WP_Term;

/**
 * Lookup for the protected default term of a taxonomy.
 *
 * Stages and statuses each have one term that cannot be deleted and that new
 * topics fall back to. Both used to be found by a reserved slug, which broke
 * the moment an admin renamed one; they carry a meta flag instead. Shared by
 * StageService and StatusService.
 */
final class DefaultTermService
{
    /**
     * The flagged term of a taxonomy, if there is one.
     */
    public static function find(string $taxonomy, string $metaKey): ?WP_Term
    {
        $terms = get_terms(
            [
                'taxonomy'   => $taxonomy,
                'hide_empty' => false,
                'meta_key'   => $metaKey,
                'meta_value' => '1',
                'number'     => 1,
            ]
        );

        if (is_wp_error($terms) || empty($terms) || !$terms[0] instanceof WP_Term) {
            return null;
        }

        return $terms[0];
    }

    /**
     * Whether a term is its taxonomy's flagged default.
     *
     * @param WP_Term $term
     */
    public static function isDefault($term, string $taxonomy, string $metaKey): bool
    {
        if ($term->taxonomy !== $taxonomy) {
            return false;
        }

        return (bool) get_term_meta((int) $term->term_id, $metaKey, true);
    }

    /**
     * Adopt or create the default term of a taxonomy.
     *
     * Installs that predate the flag identified their default by a reserved
     * slug; that term is adopted rather than a second one being added beside
     * it.
     */
    public static function ensure(string $taxonomy, string $metaKey, string $legacySlug, string $name): void
    {
        if (self::find($taxonomy, $metaKey)) {
            return;
        }

        $legacy = get_term_by('slug', $legacySlug, $taxonomy);

        if ($legacy && !is_wp_error($legacy)) {
            update_term_meta((int) $legacy->term_id, $metaKey, 1);

            return;
        }

        $term = wp_insert_term($name, $taxonomy, ['slug' => $legacySlug]);

        if (!is_wp_error($term)) {
            update_term_meta((int) $term['term_id'], $metaKey, 1);
        }
    }
}
