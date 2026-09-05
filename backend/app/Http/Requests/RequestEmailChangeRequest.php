<?php

namespace BitApps\BitConnect\Http\Requests;

if (!defined('ABSPATH')) {
    exit;
}

use BitApps\BitConnect\Deps\BitApps\WPKit\Http\Request\Request;

/**
 * Request input properties.
 *
 * @property string $email the address being claimed
 * @property int    $id    WP user ID (from route param)
 */
final class RequestEmailChangeRequest extends Request
{
    /**
     * Owner only.
     */
    public function authorize()
    {
        $userId = (int) $this->id;

        return $userId > 0 && get_current_user_id() === $userId;
    }

    public function failedAuthorizationMessage(): string
    {
        if (!is_user_logged_in()) {
            return 'You must be logged in to change your email address.';
        }

        return 'You can only change your own email address.';
    }

    public function rules()
    {
        return [
            'email' => ['required', 'string', 'email', 'max:100'],
            'id'    => ['required', 'integer', 'min:1'],
        ];
    }

    public function messages()
    {
        return [
            'email.email'    => __('Please enter a valid email address.', 'bit-connect'),
            'email.required' => __('Please enter an email address.', 'bit-connect'),
            'id.required'    => __('User ID is required.', 'bit-connect'),
        ];
    }
}
