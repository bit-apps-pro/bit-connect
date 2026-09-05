<?php

namespace BitApps\BitConnect\Http\Requests;

if (!\defined('ABSPATH')) {
    exit;
}

use BitApps\BitConnect\Deps\BitApps\WPKit\Http\Request\Request;
use BitApps\BitConnect\Deps\BitApps\WPKit\Utils\Capabilities as WpCapabilities;
use BitApps\BitConnect\Enum\Capabilities;

final class GetSeoSettingsRequest extends Request
{
    /**
     * Unlike the general settings, these are never read by the portal frontend —
     * they only steer what the server already renders — so there is no reason to
     * expose them to anyone but an administrator.
     */
    public function authorize()
    {
        return WpCapabilities::check(Capabilities::MANAGE->value);
    }

    public function failedAuthorizationMessage(): string
    {
        if (!is_user_logged_in()) {
            return 'You must be logged in to read SEO settings.';
        }

        return 'You do not have permission to read SEO settings.';
    }

    public function rules()
    {
        return [];
    }
}
