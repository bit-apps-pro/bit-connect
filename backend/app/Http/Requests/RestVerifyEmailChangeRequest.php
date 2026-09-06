<?php

namespace BitApps\BitConnect\Http\Requests;

if (!defined('ABSPATH')) {
    exit;
}

use BitApps\BitConnect\Deps\BitApps\WPKit\Http\Request\Request;

/**
 * Request for confirming a pending email address change.
 *
 * @property string $token
 * @property int    $user_id
 */
final class RestVerifyEmailChangeRequest extends Request
{
    /**
     * Public: the token is the credential. A member confirming from the new
     * inbox may well be on a device that is not signed in, and requiring a
     * session would make the link unusable exactly where it is most likely to
     * be opened.
     */
    public function authorize()
    {
        return true;
    }

    public function rules()
    {
        return [
            'token'   => ['required', 'string'],
            'user_id' => ['required', 'integer', 'min:1'],
        ];
    }

    public function messages()
    {
        return [
            'token.required'   => __('Confirmation token is required.', 'bit-connect'),
            'user_id.required' => __('This confirmation link is not valid.', 'bit-connect'),
        ];
    }
}
