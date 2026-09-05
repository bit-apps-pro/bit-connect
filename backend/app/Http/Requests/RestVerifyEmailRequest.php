<?php

namespace BitApps\BitConnect\Http\Requests;

if (!\defined('ABSPATH')) {
    exit;
}

use BitApps\BitConnect\Deps\BitApps\WPKit\Http\Request\Request;

/**
 * Request for verifying an email address via token.
 *
 * @property string   $token
 * @property null|int $user_id
 */
final class RestVerifyEmailRequest extends Request
{
    public function authorize()
    {
        return true;
    }

    public function rules()
    {
        return [
            'token'   => ['required', 'string'],
            'user_id' => ['nullable', 'integer'],
        ];
    }

    public function messages()
    {
        return [
            'token.required' => 'Verification token is required.',
        ];
    }
}
