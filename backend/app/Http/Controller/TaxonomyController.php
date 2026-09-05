<?php

namespace BitApps\BitConnect\Http\Controller;

// Prevent direct script access
if (!\defined('ABSPATH')) {
    exit;
}

use BitApps\BitConnect\Config;
use BitApps\BitConnect\Deps\BitApps\WPKit\Http\Response;
use BitApps\BitConnect\Http\Requests\GetTaxonomiesRequest;
use BitApps\BitConnect\Http\Requests\ReorderTermsRequest;
use BitApps\BitConnect\Services\TermOrderService;

final class TaxonomyController
{
    /**
     * Get all taxonomies for the bit-connect post type.
     *
     * @return Response
     */
    public function getTaxonomies(GetTaxonomiesRequest $_request) // phpcs:ignore VariableAnalysis.CodeAnalysis.VariableAnalysis.UnusedVariable
    {
        $taxonomies = get_object_taxonomies(Config::SLUG, 'objects');

        if (empty($taxonomies)) {
            return Response::success([]);
        }

        $data = [];
        foreach ($taxonomies as $taxonomy) {
            $terms = get_terms(
                [
                    'taxonomy'   => $taxonomy->name,
                    'hide_empty' => false,
                ]
            );

            if (is_wp_error($terms)) {
                $data[$taxonomy->name] = [];

                continue;
            }

            // Sorted here rather than in the clients: this payload carries no
            // meta, and it is the single read path the portal's filters and the
            // topic form all go through.
            if (TermOrderService::isOrderable($taxonomy->name)) {
                $terms = TermOrderService::sort($terms);
            }

            $termsData = [];
            foreach ($terms as $term) {
                $termsData[] = [
                    'id'     => $term->term_id,
                    'name'   => $term->name,
                    'slug'   => $term->slug,
                    'count'  => $term->count,
                    'parent' => $term->parent,
                ];
            }

            $data[$taxonomy->name] = $termsData;
        }

        return Response::success($data);
    }

    /**
     * Persist a new order for one taxonomy's terms.
     *
     * Term CRUD goes through the core terms endpoint; only ordering needs a
     * plugin route, because core can neither sort by meta nor write a whole
     * list of terms in one request.
     */
    public function reorder(ReorderTermsRequest $request)
    {
        $taxonomy = $request->orderableTaxonomy();

        if ($taxonomy === '') {
            return Response::error('This taxonomy cannot be reordered.', 400);
        }

        $terms = TermOrderService::reorder($taxonomy, $request->orderedIds());

        $data = [];

        foreach ($terms as $position => $term) {
            $data[] = [
                'id'    => (int) $term->term_id,
                'name'  => $term->name,
                'slug'  => $term->slug,
                'order' => $position,
            ];
        }

        return Response::success($data);
    }
}
