<?php

namespace BitApps\BitConnect\Http\Requests;

if (!\defined('ABSPATH')) {
    exit;
}

use BitApps\BitConnect\Deps\BitApps\WPKit\Http\Request\Request;
use BitApps\BitConnect\Deps\BitApps\WPKit\Utils\Capabilities as WpCapabilities;
use BitApps\BitConnect\Enum\Capabilities;

/**
 * Request input properties.
 *
 * @property null|bool $enabled
 */
final class UpdatePortalRootModeRequest extends Request
{
    /**
     * The most consequential write in the plugin: enabling root mode rebinds
     * the site's front page via show_on_front / page_on_front. Nothing short of
     * the forum-manage capability may reach it.
     */
    public function authorize()
    {
        return WpCapabilities::check(Capabilities::MANAGE->value);
    }

    public function failedAuthorizationMessage(): string
    {
        if (!is_user_logged_in()) {
            return 'You must be logged in to change the portal root mode.';
        }

        return 'You do not have permission to change the portal root mode.';
    }

    public function rules()
    {
        return [
            'enabled' => ['nullable'],
        ];
    }

    /**
     * Read the switch from either a JSON body (real boolean) or a form post
     * ("true" / "1" / "on"), the way the settings screens elsewhere do.
     */
    public function isEnabled(): bool
    {
        $value = $this->enabled;

        if ($value === null) {
            return false;
        }

        return filter_var($value, FILTER_VALIDATE_BOOLEAN, FILTER_NULL_ON_FAILURE) ?? (bool) $value;
    }
}
