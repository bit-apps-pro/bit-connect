<?php

namespace BitApps\BitConnect\Http\Requests;

if (!\defined('ABSPATH')) {
    exit;
}

use BitApps\BitConnect\Deps\BitApps\WPKit\Http\Request\Request;
use BitApps\BitConnect\Services\PortalAccess;

/**
 * Request input properties.
 *
 * @property int    $focus
 * @property int    $id
 * @property int    $page
 * @property int    $per_page
 * @property string $sort
 */
final class GetCommentsByPostRequest extends Request
{
    /**
     * Readable whenever the forum itself is. A members-only forum must refuse
     * this the same way it refuses the page — see PortalAccess.
     */
    public function authorize()
    {
        return PortalAccess::canView();
    }

    public function failedAuthorizationMessage(): string
    {
        return PortalAccess::deniedMessage();
    }

    public function rules()
    {
        return [
            'id'       => ['required', 'integer', 'min:1'],
            'page'     => ['nullable', 'integer', 'min:1'],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:100'],
            // A comment to land on, for `#comment-N` deep links. Pages are
            // otherwise only reachable in sequence from the first, and which one
            // holds a given comment depends on the sort — so the client cannot
            // work it out without walking every page. When set it decides the
            // page and `page` is ignored.
            'focus' => ['nullable', 'integer', 'min:1'],
            // Validated against the allowed set in the controller (no "in" rule
            // is available in this validator).
            'sort' => ['nullable', 'string'],
        ];
    }
}
