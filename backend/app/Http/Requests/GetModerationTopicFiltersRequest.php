<?php

namespace BitApps\BitConnect\Http\Requests;

if (!defined('ABSPATH')) {
    exit;
}

use BitApps\BitConnect\Deps\BitApps\WPKit\Http\Request\Request;
use BitApps\BitConnect\Services\PermissionService;

/**
 * The filter options of the moderation table. Takes no input; the type hint is
 * what makes the endpoint ask authorize().
 */
final class GetModerationTopicFiltersRequest extends Request
{
    public function authorize()
    {
        return PermissionService::canModerate();
    }

    public function failedAuthorizationMessage(): string
    {
        if (!is_user_logged_in()) {
            return 'You must be logged in to moderate posts.';
        }

        return 'You do not have permission to moderate posts.';
    }

    public function rules()
    {
        return [];
    }
}
