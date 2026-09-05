<?php

namespace BitApps\BitConnect\Http\Requests;

if (!defined('ABSPATH')) {
    exit;
}

use BitApps\BitConnect\Deps\BitApps\WPKit\Http\Request\Request;
use BitApps\BitConnect\Deps\BitApps\WPKit\Utils\Capabilities as WpCapabilities;
use BitApps\BitConnect\Enum\Capabilities;
use BitApps\BitConnect\Services\ProFeatures;

/**
 * Request input properties.
 *
 * @property int                 $id           WP user ID (from route param)
 * @property array<string, bool> $capabilities Forum cap → bool map
 */
final class UpdateUserCapabilitiesRequest extends Request
{
    /**
     * Managing the forum is not enough: per-user overrides are a pro feature.
     *
     * Only the write is gated. Overrides already granted keep applying, and
     * that is deliberate — unlike a digest, which is a recurring action a
     * lapsed licence can simply stop performing, a capability is a standing
     * decision an admin made about a person. Revoking them all when a
     * subscription expires would strip a forum's moderators of the permissions
     * they were working with, which is a far worse failure than letting an old
     * grant stand. resetUserCapabilities stays ungated for the same reason: a
     * site that can no longer manage overrides must still be able to clear
     * them.
     */
    public function authorize()
    {
        return WpCapabilities::check(Capabilities::MANAGE->value) && ProFeatures::perUserCapabilities();
    }

    public function failedAuthorizationMessage(): string
    {
        if (!is_user_logged_in()) {
            return 'You must be logged in to update user capabilities.';
        }

        if (!WpCapabilities::check(Capabilities::MANAGE->value)) {
            return 'You do not have permission to update user capabilities.';
        }

        return 'Per-user capability overrides are a Bit Connect Pro feature. Role capabilities are available to every forum.';
    }

    public function rules()
    {
        return [
            'id'           => ['required', 'integer', 'min:1'],
            'capabilities' => ['required'],
        ];
    }

    public function messages()
    {
        return [
            'id.required'           => __('User ID is required.', 'bit-connect'),
            'capabilities.required' => __('Capabilities are required.', 'bit-connect'),
        ];
    }

    /**
     * Returns only known forum capabilities cast to bool.
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
            if (\array_key_exists($cap, $raw)) {
                $result[$cap] = (bool) $raw[$cap];
            }
        }

        return $result;
    }
}
