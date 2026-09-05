<?php

namespace BitApps\BitConnect\Http\Requests;

if (!\defined('ABSPATH')) {
    exit;
}

use BitApps\BitConnect\Deps\BitApps\WPKit\Http\Request\Request;
use BitApps\BitConnect\Services\AuthService;

/**
 * Request input properties.
 *
 * @property null|string $username
 * @property string      $email
 * @property string      $password
 * @property null|string $display_name
 */
final class RestSignupRequest extends Request
{
    public function authorize()
    {
        return AuthService::canRegister();
    }

    public function failedAuthorizationMessage()
    {
        return 'Registration is currently disabled.';
    }

    public function rules()
    {
        return [
            'username' => ['nullable', 'string', 'sanitize:user', 'max:60'],
            'email'    => ['required', 'string', 'sanitize:email', 'max:100'],
            'password' => ['required', 'string', 'min:6'],
        ];
    }

    public function messages()
    {
        return [
            'email.required'    => 'Email address is required.',
            'password.required' => 'Password is required.',
            'password.min'      => 'Password must be at least 6 characters.',
        ];
    }
}
