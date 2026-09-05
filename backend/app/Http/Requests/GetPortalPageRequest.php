<?php

namespace BitApps\BitConnect\Http\Requests;

if (!\defined('ABSPATH')) {
    exit;
}

use BitApps\BitConnect\Deps\BitApps\WPKit\Http\Request\Request;
use BitApps\BitConnect\Deps\BitApps\WPKit\Utils\Capabilities as WpCapabilities;
use BitApps\BitConnect\Enum\Capabilities;

/**
 * Where the portal currently lives, for the settings screen.
 *
 * Manager-only despite being a read. The payload names the portal page's edit
 * URL and whether the front page is bound to it — a map of the site's routing
 * that only the person allowed to change it has any use for. The portal
 * frontend never calls this; it is handed its own placement by BaseView.
 */
final class GetPortalPageRequest extends Request
{
    public function authorize()
    {
        return WpCapabilities::check(Capabilities::MANAGE->value);
    }

    public function failedAuthorizationMessage(): string
    {
        if (!is_user_logged_in()) {
            return 'You must be logged in to read the portal page settings.';
        }

        return 'You do not have permission to read the portal page settings.';
    }

    public function rules()
    {
        return [];
    }
}
