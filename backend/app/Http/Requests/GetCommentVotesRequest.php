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
final class GetCommentVotesRequest extends Request
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
            'id' => ['required', 'integer', 'min:1'],
        ];
    }

    public function messages()
    {
        return [
            'id.required' => 'Comment ID is required.',
            'id.integer'  => 'Comment ID must be a valid integer.',
        ];
    }
}
