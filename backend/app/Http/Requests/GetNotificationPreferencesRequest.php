<?php

namespace BitApps\BitConnect\Http\Requests;

if (!defined('ABSPATH')) {
    exit;
}

use BitApps\BitConnect\Deps\BitApps\WPKit\Http\Request\Request;

/**
 * A member reading their own notification preferences.
 *
 * Takes no input at all — the answer is entirely about whoever is logged in.
 */
final class GetNotificationPreferencesRequest extends Request
{
    public function authorize()
    {
        return is_user_logged_in();
    }

    public function failedAuthorizationMessage(): string
    {
        return 'You must be logged in to change your notification settings.';
    }

    public function rules()
    {
        return [];
    }
}
