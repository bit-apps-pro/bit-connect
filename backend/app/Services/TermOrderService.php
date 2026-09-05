<?php

declare(strict_types=1);

namespace BitApps\BitConnect\Services;

// Prevent direct script access
if (!\defined('ABSPATH')) {
    exit;
}

use BitApps\BitConnect\Enum\Taxonomies;
use WP_Term;

/**
 * Admin-defined ordering for taxonomy terms.
 *
 * WordPress has no native ordering for terms and the core terms REST endpoint
 * cannot sort by meta, so the position lives in a term meta and every reader
 * sorts by it — here for PHP/SSR, and by the matching comparator in the
 * frontends.
 *
 * Tags are deliberately absent: the portal's tag filter orders by how often a
 * tag is used, and a free-form list that grows on its own is not something an
 * admin should have to curate by hand.
 */
final class TermOrderService
{
    /**
     * Term meta holding the admin-defined position, zero-based.
     */
    public const ORDER_META_KEY = 'order';

    /**
     * Taxonomies whose terms an admin can drag into an order.
     *
     * @return string[]
     */
    public static function orderableTaxonomies(): array
    {
        return [
            Taxonomies::STAGES->value,
            Taxonomies::STATUSES->value,
            Taxonomies::TOPIC_TYPES->value,
            Taxonomies::DEPARTMENTS->value,
        ];
    }

    public static function isOrderable(string $taxonomy): bool
    {
        return \in_array($taxonomy, self::orderableTaxonomies(), true);
    }

    /**
     * Terms of a taxonomy in the admin-defined order.
     *
     * @return WP_Term[]
     */
    public static function ordered(string $taxonomy): array
    {
        $terms = get_terms(
            [
                'taxonomy'   => $taxonomy,
                'hide_empty' => false,
            ]
        );

        if (is_wp_error($terms) || !\is_array($terms)) {
            return [];
        }

        return self::sort($terms);
    }

    /**
     * Sort terms by their admin-defined position.
     *
     * A term with no position has never been dragged — a fresh install, or one
     * created after the last reorder — and sorts after the ones that have,
     * oldest first. Before any reorder that leaves everything ordered by term
     * id, which is the order these lists have always come back in.
     *
     * @param WP_Term[] $terms
     *
     * @return WP_Term[]
     */
    public static function sort(array $terms): array
    {
        usort(
            $terms,
            static function ($first, $second) {
                $firstPosition = self::position($first);
                $secondPosition = self::position($second);

                if ($firstPosition === $secondPosition) {
                    return self::termId($first) <=> self::termId($second);
                }

                return $firstPosition <=> $secondPosition;
            }
        );

        return $terms;
    }

    /**
     * Persist a new order, positioning each term by its index in $termIds.
     *
     * Ids that do not belong to the taxonomy are ignored, and terms missing
     * from the list keep their relative order behind the ones that were sent —
     * so a stale list from a client that has not seen a newly created term
     * cannot scramble the rest.
     *
     * @param int[] $termIds
     *
     * @return WP_Term[] the full term list in its new order
     */
    public static function reorder(string $taxonomy, array $termIds): array
    {
        $terms = self::ordered($taxonomy);
        $knownIds = array_map([self::class, 'termId'], $terms);
        $requestedIds = array_map('intval', $termIds);

        $position = 0;

        foreach ($requestedIds as $termId) {
            if (!\in_array($termId, $knownIds, true)) {
                continue;
            }

            update_term_meta($termId, self::ORDER_META_KEY, $position);
            ++$position;
        }

        foreach ($terms as $term) {
            if (\in_array(self::termId($term), $requestedIds, true)) {
                continue;
            }

            update_term_meta(self::termId($term), self::ORDER_META_KEY, $position);
            ++$position;
        }

        return self::ordered($taxonomy);
    }

    /**
     * Stored position, or PHP_INT_MAX when the term has never been ordered.
     *
     * @param WP_Term $term
     */
    private static function position($term): int
    {
        $order = get_term_meta(self::termId($term), self::ORDER_META_KEY, true);

        if ($order === '' || $order === null || $order === false) {
            return PHP_INT_MAX;
        }

        return (int) $order;
    }

    /**
     * Term id of a term.
     *
     * @param WP_Term $term
     */
    private static function termId($term): int
    {
        return (int) $term->term_id;
    }
}
