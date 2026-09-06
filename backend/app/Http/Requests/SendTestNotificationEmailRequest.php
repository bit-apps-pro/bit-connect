<?php

namespace BitApps\BitConnect\Http\Requests;

if (!defined('ABSPATH')) {
    exit;
}

use BitApps\BitConnect\Deps\BitApps\WPKit\Http\Request\Request;
use BitApps\BitConnect\Deps\BitApps\WPKit\Utils\Capabilities as WpCapabilities;
use BitApps\BitConnect\Enum\Capabilities;

/**
 * Sending a test notification email.
 *
 * Takes no recipient on purpose. The controller sends to the signed-in admin's
 * own address, so this endpoint cannot be used to send mail to an arbitrary
 * address from somebody else's forum — a settings-page diagnostic that accepts
 * a `to` field is an open relay wearing a lab coat.
 */
final class SendTestNotificationEmailRequest extends Request
{
    public function authorize()
    {
        return WpCapabilities::check(Capabilities::MANAGE->value);
    }

    public function failedAuthorizationMessage(): string
    {
        if (!is_user_logged_in()) {
            return 'You must be logged in to send a test email.';
        }

        return 'You do not have permission to send a test email.';
    }

    public function rules()
    {
        return [];
    }
}
