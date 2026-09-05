<?php

namespace BitApps\BitConnect\Http\Requests;

if (!defined('ABSPATH')) {
    exit;
}

use BitApps\BitConnect\Deps\BitApps\WPKit\Http\Request\Request;

/**
 * Request input properties.
 *
 * @property string $username
 * @property string $password
 * @property bool   $rememberMe
 * @property string $nonce
 */
final class AjaxLoginRequest extends Request
{
    public function authorize()
    {
        // Nonce verification — protects against CSRF on the login endpoint
        return wp_verify_nonce((string) ($this->nonce ?? ''), 'bit_connect_ajax_login') !== false;
    }

    public function failedAuthorizationMessage()
    {
        return 'Security check failed. Please refresh the page and try again.';
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
            'username.required' => 'Username or email is required.',
            'password.required' => 'Password is required.',
        ];
    }
}
