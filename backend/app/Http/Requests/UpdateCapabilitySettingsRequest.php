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
 * @property string               $role          WP role slug
 * @property array<string, bool>  $capabilities  Map of forum cap → bool
 */
final class UpdateCapabilitySettingsRequest extends Request
{
    public function authorize()
    {
        return WpCapabilities::check(Capabilities::MANAGE->value);
    }

    public function failedAuthorizationMessage(): string
    {
        if (!is_user_logged_in()) {
            return 'You must be logged in to update capability settings.';
        }

        return 'You do not have permission to update capability settings.';
    }

    public function rules()
    {
        return [
            'role'         => ['required', 'string'],
            'capabilities' => ['required'],
        ];
    }

    public function messages()
    {
        return [
            'role.required'         => __('Role is required.', 'bit-connect'),
            'capabilities.required' => __('Capabilities map is required.', 'bit-connect'),
        ];
    }

    /**
     * Returns a sanitized capabilities array (only known forum caps, cast to bool).
     *
     * @return array<string, bool>
     */
    public function sanitizedCapabilities(): array
    {
        $raw = $this->capabilities;
        $result = [];

        if (!\is_array($raw)) {
            return $result;
        }

        foreach (Capabilities::values() as $cap) {
            $result[$cap] = !empty($raw[$cap]);
        }

        return $result;
    }
}
