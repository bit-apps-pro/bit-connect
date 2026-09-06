<?php

namespace BitApps\BitConnect\Http\Requests;

if (!defined('ABSPATH')) {
    exit;
}

use BitApps\BitConnect\Deps\BitApps\WPKit\Http\Request\Request;
use BitApps\BitConnect\Deps\BitApps\WPKit\Utils\Capabilities;
use BitApps\BitConnect\Services\AuthService;
use BitApps\BitConnect\Services\TermOrderService;

/**
 * Request input properties.
 *
 * @property string $taxonomy
 * @property array  $ids
 */
final class ReorderTermsRequest extends Request
{
    public function authorize()
    {
        return Capabilities::check(AuthService::CAP_MANAGE);
    }

    public function failedAuthorizationMessage(): string
    {
        if (!is_user_logged_in()) {
            return 'You must be logged in to reorder terms.';
        }

        return 'You do not have permission to reorder terms.';
    }

    public function rules()
    {
        return [
            'taxonomy' => ['required', 'string'],
            'ids'      => ['required', 'array'],
        ];
    }

    public function messages()
    {
        return [
            'taxonomy.required' => 'taxonomy is required.',
            'ids.required'      => 'ids is required.',
            'ids.array'         => 'ids must be an array of term ids.',
        ];
    }

    /**
     * The taxonomy from the URL, or an empty string when it is not one this
     * plugin lets an admin order.
     *
     * The allowlist is the boundary: without it the route would write order
     * meta onto terms of any taxonomy on the site.
     */
    public function orderableTaxonomy(): string
    {
        $taxonomy = \is_string($this->taxonomy) ? $this->taxonomy : '';

        return TermOrderService::isOrderable($taxonomy) ? $taxonomy : '';
    }

    /**
     * Term ids in their new order, deduplicated.
     *
     * A repeated id would consume two positions and push everything after it
     * out by one, so only the first occurrence counts.
     *
     * @return int[]
     */
    public function orderedIds(): array
    {
        $ids = \is_array($this->ids) ? $this->ids : [];

        return array_values(array_unique(array_filter(array_map('absint', $ids))));
    }
}
