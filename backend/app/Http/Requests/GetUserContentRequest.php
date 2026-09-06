<?php

namespace BitApps\BitConnect\Http\Requests;

if (!defined('ABSPATH')) {
    exit;
}

use BitApps\BitConnect\Deps\BitApps\WPKit\Http\Request\Request;
use BitApps\BitConnect\Services\PortalAccess;

/**
 * Paginated list of a member's public contributions (topics or comments).
 *
 * Request input properties.
 *
 * @property int           $id
 * @property null|int      $page
 * @property null|int      $per_page
 */
final class GetUserContentRequest extends Request
{
    /**
     * Public: both lists are drawn from content that already renders on the
     * portal. The service restricts them to published topics and approved
     * comments, so this adds no visibility beyond browsing the portal.
     */

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
            'per_page' => ['nullable', 'integer', 'min:1', 'max:50'],
        ];
    }

    public function messages()
    {
        return [
            'id.required'  => 'User ID is required.',
            'id.integer'   => 'User ID must be a valid integer.',
            'per_page.max' => 'The per_page parameter cannot exceed 50.',
        ];
    }
}
