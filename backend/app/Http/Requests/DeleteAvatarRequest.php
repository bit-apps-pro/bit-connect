<?php

namespace BitApps\BitConnect\Http\Requests;

if (!\defined('ABSPATH')) {
    exit;
}

use BitApps\BitConnect\Deps\BitApps\WPKit\Http\Request\Request;

/**
 * Request input properties.
 *
 * @property int $id
 */
final class DeleteAvatarRequest extends Request
{
    /**
     * Owner only, matching UploadAvatarRequest.
     */
    public function authorize()
    {
        $userId = (int) $this->id;

        return $userId > 0 && get_current_user_id() === $userId;
    }

    public function failedAuthorizationMessage(): string
    {
        if (!is_user_logged_in()) {
            return 'You must be logged in to change your profile picture.';
        }

        return 'You can only change your own profile picture.';
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
