<?php

namespace BitApps\BitConnect\Http\Requests;

if (!\defined('ABSPATH')) {
    exit;
}

use BitApps\BitConnect\Deps\BitApps\WPKit\Http\Request\Request;

/**
 * Request input properties.
 *
 * @property int $id WP user ID (from route param)
 */
final class SendPasswordResetRequest extends Request
{
    /**
     * Owner only.
     *
     * The logged-out forgot-password endpoint takes a login and is deliberately
     * open; this one takes none and always mails the signed-in account, so it
     * cannot be used to find out which addresses are registered.
     */
    public function authorize()
    {
        $userId = (int) $this->id;

        return $userId > 0 && get_current_user_id() === $userId;
    }

    public function failedAuthorizationMessage(): string
    {
        if (!is_user_logged_in()) {
            return 'You must be logged in to request a password reset.';
        }

        return 'You can only request a password reset for your own account.';
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
            'id.required' => __('User ID is required.', 'bit-connect'),
        ];
    }
}
