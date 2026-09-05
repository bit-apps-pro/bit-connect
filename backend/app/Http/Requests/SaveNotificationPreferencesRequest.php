<?php

namespace BitApps\BitConnect\Http\Requests;

if (!defined('ABSPATH')) {
    exit;
}

use BitApps\BitConnect\Deps\BitApps\WPKit\Http\Request\Request;
use BitApps\BitConnect\Enum\NotificationSettings;

/**
 * Request input properties.
 *
 * `types` is validated only as an array. Its contents are checked one row at a
 * time by NotificationPreferences::save(), which is the only place that knows
 * which types exist, which are moderator-only, and which the admin has locked —
 * and which drops the rows it will not take rather than failing the whole save.
 * A member correcting one switch should not be told their form is invalid
 * because a tab left open since yesterday still lists a type an admin has since
 * locked.
 *
 * @property null|array  $types     type value => {inapp: bool, email: bool}
 * @property null|string $frequency instant | daily | weekly | never
 */
final class SaveNotificationPreferencesRequest extends Request
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
        return [
            'types'     => ['nullable', 'array'],
            'frequency' => ['nullable', 'string'],
        ];
    }

    public function messages()
    {
        return [
            'frequency.string' => \sprintf(
                // translators: %s: comma-separated list of valid email frequencies
                __('Choose one of: %s.', 'bit-connect'),
                implode(', ', NotificationSettings::frequencies())
            ),
        ];
    }
}
