<?php

namespace BitApps\BitConnect\Http\Requests;

if (!\defined('ABSPATH')) {
    exit;
}

use BitApps\BitConnect\Deps\BitApps\WPKit\Http\Request\Request;
use BitApps\BitConnect\Services\PermissionService;

/**
 * Request input properties.
 *
 * @property int         $id
 * @property string      $content
 * @property null|int    $parent_id
 * @property null|array  $attachments
 */
final class CreateCommentRequest extends Request
{
    public function authorize()
    {
        return PermissionService::canCreateComment();
    }

    public function failedAuthorizationMessage(): string
    {
        if (!is_user_logged_in()) {
            return 'You must be logged in to create a comment.';
        }

        return 'You do not have permission to create a comment.';
    }

    public function rules()
    {
        return [
            'id'          => ['required', 'integer', 'min:1'],
            'content'     => ['required', 'string'],
            'parent_id'   => ['nullable', 'integer', 'min:1'],
            'attachments' => ['nullable', 'array'],
        ];
    }

    public function messages()
    {
        return [
            'id.required'      => 'Post ID is required.',
            'id.integer'       => 'Post ID must be a valid integer.',
            'content.required' => 'Comment content is required.',
        ];
    }
}
