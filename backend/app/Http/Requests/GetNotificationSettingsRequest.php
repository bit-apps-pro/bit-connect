<?php

namespace BitApps\BitConnect\Http\Requests;

if (!\defined('ABSPATH')) {
    exit;
}

use BitApps\BitConnect\Deps\BitApps\WPKit\Http\Request\Request;
use BitApps\BitConnect\Deps\BitApps\WPKit\Utils\Capabilities as WpCapabilities;
use BitApps\BitConnect\Enum\Capabilities;

/**
 * Reading the forum-wide notification settings.
 *
 * Administrator only. A member's own preference screen is a different endpoint
 * that answers about them alone — this one exposes the sender address, the
 * digest schedule and which rows members are allowed to depart from, none of
 * which is theirs to see.
 */
final class GetNotificationSettingsRequest extends Request
{
    public function authorize()
    {
        return WpCapabilities::check(Capabilities::MANAGE->value);
    }

    public function failedAuthorizationMessage(): string
    {
        if (!is_user_logged_in()) {
            return 'You must be logged in to read notification settings.';
        }

        return 'You do not have permission to read notification settings.';
    }

    public function rules()
    {
        return [];
    }
}
