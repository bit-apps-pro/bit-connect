<?php

namespace BitApps\BitConnect\Http\Requests;

if (!\defined('ABSPATH')) {
    exit;
}

use BitApps\BitConnect\Deps\BitApps\WPKit\Http\Request\Request;
use BitApps\BitConnect\Services\PermissionService;

/**
 * Provides validation for creating a topic.
 *
 * @property string $post_title
 * @property string $post_content
 * @property null|string $post_name
 * @property null|string $post_status
 * @property null|array $attachments
 * @property null|array $topic-types
 * @property null|array $departments
 * @property null|array $stages
 * @property null|array $statuses
 * @property null|array $tags
 */
final class CreateTopicRequest extends Request
{
    public function authorize()
    {
        return PermissionService::canCreatePost();
    }

    public function rules()
    {
        return [
            'post_title'   => ['required', 'string', 'sanitize:text', 'max:200'],
            'post_content' => ['required', 'string', 'max:10000'],
            // `sanitize:title` is WordPress' own `sanitize_title()`, so whatever
            // reaches the service is already a valid slug. Left blank, the
            // service derives one from the title the way core does.
            'post_name'   => ['nullable', 'string', 'sanitize:title', 'max:200'],
            'post_status' => ['nullable', 'string', 'sanitize:text'],
            'attachments' => ['nullable', 'array'],
            'topic-types' => ['nullable', 'integer', 'min:1'],
            'departments' => ['nullable', 'integer', 'min:1'],
            'tags'        => ['nullable', 'array'],
            'tags.*'      => ['nullable', 'integer', 'min:1'],
        ];
    }

    public function messages()
    {
        return [
            'post_title.required'   => 'The topic title is required.',
            'post_title.max'        => 'The topic title cannot exceed 200 characters.',
            'post_name.string'      => 'The topic slug must be a string.',
            'post_name.max'         => 'The topic slug cannot exceed 200 characters.',
            'post_content.required' => 'The topic description is required.',
            'post_content.max'      => 'The topic description cannot exceed 10000 characters.',

            'attachments.*.max' => 'Each attachment file cannot exceed 10MB.',
            'topic-type'        => 'Each topic type must be a valid ID.',
            'departments'       => 'Each department must be a valid ID.',
            'tags.*.integer'    => 'Each tag must be a valid ID.',
            'tags.*.min'        => 'Each tag ID must be at least 1.',
        ];
    }
}
