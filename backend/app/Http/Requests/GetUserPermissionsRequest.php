<?php

namespace BitApps\BitConnect\Http\Requests;

if (!\defined('ABSPATH')) {
    exit;
}

use BitApps\BitConnect\Deps\BitApps\WPKit\Http\Request\Request;
use BitApps\BitConnect\Services\PermissionService;

/**
 * What a member is allowed to do on the portal.
 *
 * Request input properties.
 *
 * @property int $id
 */
final class GetUserPermissionsRequest extends Request
{
    /**
     * Owner or moderator only.
     *
     * The list is useful to the member ("why can't I pin this?") but it is a
     * permission map, not published content — handing every visitor a readout
     * of who can moderate is an invitation to go looking for the weakest one.
     */
    public function authorize()
    {
        $userId = (int) $this->id;

        return ($userId > 0 && get_current_user_id() === $userId) || PermissionService::canModerate();
    }

    public function failedAuthorizationMessage(): string
    {
        if (!is_user_logged_in()) {
            return 'You must be logged in to view permissions.';
        }

        return 'You can only view your own permissions.';
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
