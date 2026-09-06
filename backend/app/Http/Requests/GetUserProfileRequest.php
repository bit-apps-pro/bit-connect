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
 * @property string $id profile slug, or a numeric user id
 */
final class GetUserProfileRequest extends Request
{
    /**
     * Public: returns display name, avatar and join date only — the same
     * identity already attached to every topic and comment the member wrote.
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

    /**
     * Typed as a string, not an integer, because profile URLs address members
     * by slug (`/user/aiden-carter`). A numeric value is still accepted so the
     * endpoint keeps working for any caller holding an id.
     */
    public function rules()
    {
        return [
            'id' => ['required', 'string', 'max:200'],
        ];
    }

    public function messages()
    {
        return [
            'id.required' => 'A user slug or ID is required.',
            'id.max'      => 'The user identifier is too long.',
        ];
    }
}
