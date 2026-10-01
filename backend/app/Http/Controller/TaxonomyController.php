<?php

namespace BitApps\BitConnect\Http\Controller;

// Prevent direct script access
if (!defined('ABSPATH')) {
    exit;
}

use BitApps\BitConnect\Config;
use BitApps\BitConnect\Deps\BitApps\WPKit\Http\Response;
use BitApps\BitConnect\Enum\Taxonomies;
use BitApps\BitConnect\Http\Requests\GetTaxonomiesRequest;
use BitApps\BitConnect\Http\Requests\ReorderTermsRequest;
use BitApps\BitConnect\Services\TermOrderService;
use BitApps\BitConnect\Services\TopicTaxonomies;

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
            // order meta, and it is the single read path the portal's filters
            // and the topic form all go through.
            if (TermOrderService::isOrderable($taxonomy->name)) {
                $terms = TermOrderService::sort($terms);
            }

            // Icons ride along for the taxonomies that have them, so the portal
            // sider can list terms with their artwork. get_terms() has
            // already primed the term meta cache, so these reads cost no query.
            $hasIcons = \in_array($taxonomy->name, [Taxonomies::STAGES->value, Taxonomies::STATUSES->value], true)
                || (TopicTaxonomies::forTaxonomy($taxonomy->name)['icons'] ?? false);

            // Names are stored escaped ("API &amp; Integrations"); JSON wants the text.
            $termsData = [];
            foreach ($terms as $term) {
                $termData = [
                    'id'     => $term->term_id,
                    'name'   => wp_specialchars_decode($term->name, ENT_QUOTES),
                    'slug'   => $term->slug,
                    'count'  => $term->count,
                    'parent' => $term->parent,
                ];

                if ($hasIcons) {
                    $termData['meta'] = [
                        'bit_connect_icon_url'      => (string) get_term_meta($term->term_id, 'bit_connect_icon_url', true),
                        'bit_connect_icon_dark_url' => (string) get_term_meta($term->term_id, 'bit_connect_icon_dark_url', true),
                    ];
                }

                $termsData[] = $termData;
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
                'name'  => wp_specialchars_decode($term->name, ENT_QUOTES),
                'slug'  => $term->slug,
                'order' => $position,
            ];
        }

        return Response::success($data);
    }
}
