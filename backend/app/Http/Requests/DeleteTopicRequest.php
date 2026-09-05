<?php

namespace BitApps\BitConnect\Http\Requests;

if (!\defined('ABSPATH')) {
    exit;
}

use BitApps\BitConnect\Deps\BitApps\WPKit\Http\Request\Request;
use BitApps\BitConnect\Services\PermissionService;

/**
 * Provides validation for deleting a topic.
 *
 * @property int $id
 */
final class DeleteTopicRequest extends Request
{
    public function authorize()
    {
        return PermissionService::canDeletePost((int) $this->id);
    }

    public function failedAuthorizationMessage(): string
    {
        if (!is_user_logged_in()) {
            return 'You must be logged in to delete this topic.';
        }

        return 'You do not have permission to delete this topic.';
    }

    public function rules()
    {
        return [
            'id' => ['required', 'integer', 'min:1'],
        ];
    }

    public function messages()
    {
        return [
            'id.required' => 'The topic ID is required.',
            'id.integer'  => 'The topic ID must be a valid integer.',
            'id.min'      => 'The topic ID must be at least 1.',
        ];
    }
}
