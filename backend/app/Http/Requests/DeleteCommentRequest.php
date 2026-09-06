<?php

namespace BitApps\BitConnect\Http\Requests;

if (!defined('ABSPATH')) {
    exit;
}

use BitApps\BitConnect\Deps\BitApps\WPKit\Http\Request\Request;
use BitApps\BitConnect\Services\PermissionService;

/**
 * Request input properties.
 *
 * @property int $id
 */
final class DeleteCommentRequest extends Request
{
    public function authorize()
    {
        return PermissionService::canDeleteComment((int) $this->id);
    }

    public function failedAuthorizationMessage(): string
    {
        if (!is_user_logged_in()) {
            return 'You must be logged in to delete this comment.';
        }

        return 'You do not have permission to delete this comment.';
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
            'id.required' => 'Comment ID is required.',
            'id.integer'  => 'Comment ID must be a valid integer.',
        ];
    }
}
