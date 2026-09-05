<?php

namespace BitApps\BitConnect\Http\Requests;

if (!\defined('ABSPATH')) {
    exit;
}

use BitApps\BitConnect\Deps\BitApps\WPKit\Http\Request\Request;
use BitApps\BitConnect\Deps\BitApps\WPKit\Utils\Capabilities;
use BitApps\BitConnect\Services\AuthService;

/**
 * Provides validation for creating a post.
 *
 * @property string $title
 * @property string $description
 */
final class CreatePostRequest extends Request
{
    public function authorize()
    {
        return Capabilities::check(AuthService::CAP_MANAGE);
    }

    public function failedAuthorizationMessage(): string
    {
        if (!is_user_logged_in()) {
            return 'You must be logged in to create a post.';
        }

        return 'You do not have permission to create a post.';
    }

    public function rules()
    {
        return [
            'title'       => ['required', 'string', 'sanitize:text', 'max:200'],
            'description' => ['required', 'string', 'sanitize:textarea', 'max:10000'],
        ];
    }
}
