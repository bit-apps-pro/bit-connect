<?php

namespace BitApps\BitConnect\Http\Requests;

if (!defined('ABSPATH')) {
    exit;
}

use BitApps\BitConnect\Deps\BitApps\WPKit\Http\Request\Request;
use BitApps\BitConnect\Deps\BitApps\WPKit\Utils\Capabilities as WpCapabilities;
use BitApps\BitConnect\Enum\Capabilities;

final class GetGeneralSettingsRequest extends Request
{
    /**
     * Manager-only. The portal never calls this — BaseView hands the page the
     * few branding values it renders, and only the admin screens read the rest
     * (logo URLs, promo copy, filter configuration, the access mode itself).
     */
    public function authorize()
    {
        return WpCapabilities::check(Capabilities::MANAGE->value);
    }

    public function failedAuthorizationMessage(): string
    {
        if (!is_user_logged_in()) {
            return 'You must be logged in to read the general settings.';
        }

        return 'You do not have permission to read the general settings.';
    }

    public function rules()
    {
        return [];
    }
}
