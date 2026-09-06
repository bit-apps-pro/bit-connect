<?php

namespace BitApps\BitConnect\Http\Requests;

if (!defined('ABSPATH')) {
    exit;
}

use BitApps\BitConnect\Deps\BitApps\WPKit\Http\Request\Request;
use BitApps\BitConnect\Services\PermissionService;

/**
 * Provides validation for the topic slug availability check.
 *
 * @property string $slug
 * @property null|int $topic_id
 */
final class CheckTopicSlugRequest extends Request
{
    /**
     * Gated by the same permission as the save it previews: whoever may not
     * create or edit the topic has no business enumerating slugs either.
     */
    public function authorize()
    {
        $topicId = (int) ($this->topic_id ?? 0);

        if ($topicId > 0) {
            return PermissionService::canEditPost($topicId);
        }

        return PermissionService::canCreatePost();
    }

    public function failedAuthorizationMessage(): string
    {
        if (!is_user_logged_in()) {
            return 'You must be logged in to check a topic slug.';
        }

        return 'You do not have permission to check a topic slug.';
    }

    /**
     * `sanitize:title` is deliberately absent. The response reports the
     * sanitized form back to the author, so the sanitizing happens in
     * TopicService::previewSlug() where the verdict is formed — sanitizing
     * first would let input that reduces to '' fail `required` instead.
     */
    public function rules()
    {
        return [
            'slug'     => ['required', 'string', 'max:200'],
            'topic_id' => ['nullable', 'integer', 'min:1'],
        ];
    }

    public function messages()
    {
        return [
            'slug.required'    => 'The topic slug is required.',
            'slug.string'      => 'The topic slug must be a string.',
            'slug.max'         => 'The topic slug cannot exceed 200 characters.',
            'topic_id.integer' => 'The topic ID must be a valid integer.',
            'topic_id.min'     => 'The topic ID must be at least 1.',
        ];
    }
}
