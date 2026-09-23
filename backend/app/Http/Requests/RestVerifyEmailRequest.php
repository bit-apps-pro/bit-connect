<?php

namespace BitApps\BitConnect\Http\Requests;

if (!defined('ABSPATH')) {
    exit;
}

use BitApps\BitConnect\Deps\BitApps\WPKit\Http\Request\Request;

/**
 * Confirm a parked registration by its token.
 *
 * The token alone names the registration — it is the key the pending data was
 * parked under — so nothing else is accepted. An earlier release also took a
 * `user_id` for a per-user meta token that nothing ever wrote.
 *
 * @property string $token
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
            'token' => ['required', 'string', 'max:64'],
        ];
    }

    public function messages()
    {
        return [
            'token.required' => 'Verification token is required.',
        ];
    }
}
