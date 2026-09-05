<?php

namespace BitApps\BitConnect\Http\Requests;

if (!\defined('ABSPATH')) {
    exit;
}

use BitApps\BitConnect\Deps\BitApps\WPKit\Http\Request\Request;

/**
 * Validates the forgot password request.
 *
 * @property string $login Username or email address
 */
final class RestForgotPasswordRequest extends Request
{
    public function authorize()
    {
        return true;
    }

    public function rules()
    {
        return [
            'login' => ['required', 'string'],
        ];
    }

    public function messages()
    {
        return [
            'login.required' => 'Please enter your username or email address.',
        ];
    }
}
