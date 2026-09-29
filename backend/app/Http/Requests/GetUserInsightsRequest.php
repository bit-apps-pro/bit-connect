<?php

namespace BitApps\BitConnect\Http\Requests;

if (!defined('ABSPATH')) {
    exit;
}

use BitApps\BitConnect\Deps\BitApps\WPKit\Http\Request\Request;
use BitApps\BitConnect\Http\Rules\InRule;
use BitApps\BitConnect\Services\PortalAccess;
use BitApps\BitConnect\Services\UserInsightsService;

/**
 * A member's activity over a period — the profile's Overview.
 *
 * Request input properties.
 *
 * @property int         $id
 * @property null|string $period
 */
final class GetUserInsightsRequest extends Request
{
    /**
     * Readable whenever the forum itself is: every figure is drawn from topics,
     * comments and votes the portal already shows. See PortalAccess.
     */
    public function authorize()
    {
        return PortalAccess::canView();
    }

    public function failedAuthorizationMessage(): string
    {
        return PortalAccess::deniedMessage();
    }

    public function rules()
    {
        return [
            'id' => ['required', 'integer', 'min:1'],
            // Omitted, the Overview reads the last 30 days.
            'period' => ['nullable', 'string', new InRule(UserInsightsService::PERIODS)],
        ];
    }

    public function messages()
    {
        return [
            'id.required' => 'User ID is required.',
            'id.integer'  => 'User ID must be a valid integer.',
        ];
    }
}
