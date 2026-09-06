<?php

namespace BitApps\BitConnect\Http\Requests;

if (!defined('ABSPATH')) {
    exit;
}

use BitApps\BitConnect\Deps\BitApps\WPKit\Http\Request\Request;
use BitApps\BitConnect\Deps\BitApps\WPKit\Utils\Capabilities;
use BitApps\BitConnect\Services\AuthService;

final class GetAllPostsRequest extends Request
{
    public function authorize()
    {
        return Capabilities::check(AuthService::CAP_MANAGE);
    }

    public function failedAuthorizationMessage(): string
    {
        if (!is_user_logged_in()) {
            return 'You must be logged in to access posts.';
        }

        return 'You do not have permission to access posts.';
    }

    public function rules()
    {
        return [];
    }
}
