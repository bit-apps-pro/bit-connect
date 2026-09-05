<?php

namespace BitApps\BitConnect\Http\Requests;

if (!defined('ABSPATH')) {
    exit;
}

use BitApps\BitConnect\Deps\BitApps\WPKit\Http\Request\Request;

/**
 * Request input properties.
 *
 * @property string $current_password the password being replaced
 * @property int    $id               WP user ID (from route param)
 * @property string $new_password
 */
final class ChangePasswordRequest extends Request
{
    /**
     * Owner only. Resetting someone else's password is wp-admin's job, and the
     * portal has no reason to offer it.
     */
    public function authorize()
    {
        $userId = (int) $this->id;

        return $userId > 0 && get_current_user_id() === $userId;
    }

    public function failedAuthorizationMessage(): string
    {
        if (!is_user_logged_in()) {
            return 'You must be logged in to change your password.';
        }

        return 'You can only change your own password.';
    }

    public function rules()
    {
        return [
            'id' => ['required', 'integer', 'min:1'],
            // Nullable rather than required: an account an SSO plugin created
            // may have no password to quote back. Whether one is actually needed
            // is decided in the controller, which can see the stored hash — a
            // rule here could only ever guess.
            'current_password' => ['nullable', 'string'],
            // Matches the floor the signup form enforces; raising it here alone
            // would leave members unable to re-enter the password they signed up
            // with.
            'new_password' => ['required', 'string', 'min:6'],
        ];
    }

    public function messages()
    {
        return [
            'id.required'           => __('User ID is required.', 'bit-connect'),
            'new_password.min'      => __('Password must be at least 6 characters.', 'bit-connect'),
            'new_password.required' => __('Please enter a new password.', 'bit-connect'),
        ];
    }
}
