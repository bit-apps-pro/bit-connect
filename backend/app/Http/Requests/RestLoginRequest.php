<?php

namespace BitApps\BitConnect\Http\Requests;

if (!\defined('ABSPATH')) {
    exit;
}

use BitApps\BitConnect\Deps\BitApps\WPKit\Http\Request\Request;

/**
 * Request input properties.
 *
 * @property string $username
 * @property string $password
 * @property bool   $remember
 */
final class RestLoginRequest extends Request
{
    public function authorize()
    {
        // Open endpoint — the user is not logged in yet. WP REST nonce in the
        // X-WP-Nonce header provides CSRF protection.
        return true;
    }

    public function rules()
    {
        return [
            'username' => ['required', 'string'],
            'password' => ['required', 'string'],
        ];
    }

    public function messages()
    {
        return [
            'username.required' => 'Username or email address is required.',
            'password.required' => 'Password is required.',
        ];
    }
}
