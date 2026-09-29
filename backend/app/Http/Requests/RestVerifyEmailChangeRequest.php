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
     * Owner only, exactly as WordPress core's own `_new_email` confirmation on
     * the profile screen: the link proves the member can read the new inbox,
     * the session proves they own the account, and the address moves only when
     * the same person holds both.
     *
     * The token alone would not do. A mistyped address lands the link in a
     * stranger's inbox, and with no session required that stranger could point
     * the account at themselves and reset its password. A member who opens the
     * link somewhere they are signed out is sent through login first and
     * brought back.
     */
    public function authorize()
    {
        $userId = (int) $this->user_id;

        return $userId > 0 && get_current_user_id() === $userId;
    }

    public function failedAuthorizationMessage(): string
    {
        if (!is_user_logged_in()) {
            return __('Please sign in to confirm your new email address.', 'bit-connect');
        }

        return __('This confirmation link belongs to a different account.', 'bit-connect');
    }

    public function rules()
    {
        return [
            'token'   => ['required', 'string', 'max:64'],
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
