<?php

namespace BitApps\BitConnect\Http\Requests;

if (!defined('ABSPATH')) {
    exit;
}

use BitApps\BitConnect\Deps\BitApps\WPKit\Http\Request\Request;
use BitApps\BitConnect\Deps\BitApps\WPKit\Utils\Capabilities;
use BitApps\BitConnect\Services\AuthService;
use BitApps\BitConnect\Services\TermMergeService;

/**
 * Request input properties.
 *
 * @property string $taxonomy from the URL
 * @property int    $from     the term being merged away
 * @property int    $into     the term that survives
 */
final class MergeTermsRequest extends Request
{
    public function authorize()
    {
        return Capabilities::check(AuthService::CAP_MANAGE);
    }

    public function failedAuthorizationMessage(): string
    {
        if (!is_user_logged_in()) {
            return 'You must be logged in to merge tags.';
        }

        return 'You do not have permission to merge tags.';
    }

    public function rules()
    {
        return [
            'taxonomy' => ['required', 'string'],
            'from'     => ['required', 'integer', 'min:1'],
            'into'     => ['required', 'integer', 'min:1'],
        ];
    }

    public function messages()
    {
        return [
            'from.required' => 'Choose the tag to merge.',
            'into.required' => 'Choose the tag to merge into.',
            'from.integer'  => 'The tag to merge must be a valid ID.',
            'into.integer'  => 'The tag to merge into must be a valid ID.',
        ];
    }

    /**
     * The taxonomy from the URL, or '' when it is not one this plugin merges.
     *
     * The allowlist is the boundary, as in ReorderTermsRequest: without it
     * the route would delete terms of any taxonomy on the site.
     */
    public function mergeableTaxonomy(): string
    {
        $taxonomy = \is_string($this->taxonomy) ? $this->taxonomy : '';

        return TermMergeService::isMergeable($taxonomy) ? $taxonomy : '';
    }
}
