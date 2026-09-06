<?php

namespace BitApps\BitConnect\Http\Requests;

if (!defined('ABSPATH')) {
    exit;
}

use BitApps\BitConnect\Deps\BitApps\WPKit\Http\Request\Request;
use BitApps\BitConnect\Services\PortalAccess;

/**
 * Request input properties.
 *
 * @property int $id
 */
final class GetUserStatsRequest extends Request
{
    /**
     * Public: the figures returned are aggregates of content that is already
     * visible on the portal, so anyone who can read a topic can read its
     * author's totals. No email, role or other account detail is exposed.
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
            'id' => ['required', 'integer', 'min:1'],
        ];
    }

    public function messages()
    {
        return [
            'id.required' => 'User ID is required.',
            'id.integer'  => 'User ID must be a valid integer.',
        ];
    }
}
