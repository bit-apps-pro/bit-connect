<?php

namespace BitApps\BitConnect\Http\Requests;

if (!defined('ABSPATH')) {
    exit;
}

use BitApps\BitConnect\Deps\BitApps\WPKit\Http\Request\Request;
use BitApps\BitConnect\Services\PermissionService;

/**
 * Provides validation for updating a topic.
 *
 * @property int $id
 * @property null|string $post_title
 * @property null|string $post_content
 * @property null|string $post_name
 * @property null|string $post_status
 * @property null|array $attachments
 * @property null|array $topic-types
 * @property null|array $departments
 * @property null|array $stages
 * @property null|array $statuses
 * @property null|array $tags
 */
final class UpdateTopicRequest extends Request
{
    /**
     * Coarse gate: may this user change anything about this topic at all.
     *
     * Moderators are admitted because this same endpoint carries status and
     * stage changes, which are theirs to make. It does not follow that they may
     * touch the words — TopicController::update() gates the content fields on
     * authorship alone, and drops a title or body sent by anyone else.
     */
    public function authorize()
    {
        return PermissionService::canEditPost((int) $this->id)
            || PermissionService::canModerate();
    }

    public function failedAuthorizationMessage(): string
    {
        if (!is_user_logged_in()) {
            return 'You must be logged in to edit this topic.';
        }

        return 'You do not have permission to edit this topic.';
    }

    public function rules()
    {
        return [
            'id'           => ['required', 'integer', 'min:1'],
            'post_title'   => ['nullable', 'string', 'sanitize:text', 'max:200'],
            'post_content' => ['nullable', 'string', 'max:10000'],
            // See CreateTopicRequest — omitted, the topic keeps the slug it has.
            'post_name'   => ['nullable', 'string', 'sanitize:title', 'max:200'],
            'post_status' => ['nullable', 'string', 'sanitize:text'],
            'attachments' => ['nullable', 'array'],
            'topic-types' => ['nullable', 'integer', 'min:1'],
            'departments' => ['nullable', 'integer', 'min:1'],
            'stages'      => ['nullable', 'min:1'],
            'statuses'    => ['nullable', 'integer', 'min:1'],
            'tags'        => ['nullable', 'array'],
            'tags.*'      => ['nullable', 'integer'],
            'is_pinned'   => ['nullable', 'boolean'],
            'is_locked'   => ['nullable', 'boolean'],
        ];
    }

    public function messages()
    {
        return [
            'id.required'           => 'The topic ID is required.',
            'id.integer'            => 'The topic ID must be a valid integer.',
            'id.min'                => 'The topic ID must be at least 1.',
            'post_title.max'        => 'The topic title cannot exceed 200 characters.',
            'post_name.string'      => 'The topic slug must be a string.',
            'post_name.max'         => 'The topic slug cannot exceed 200 characters.',
            'post_content.max'      => 'The topic description cannot exceed 10000 characters.',
            'attachments.*.max'     => 'Each attachment file cannot exceed 10MB.',
            'topic-types.*.integer' => 'Each topic type must be a valid ID.',
            'topic-types.*.min'     => 'Each topic type ID must be at least 1.',
            'departments.*.integer' => 'Each department must be a valid ID.',
            'departments.*.min'     => 'Each department ID must be at least 1.',
            'stages.*.integer'      => 'Each stage must be a valid ID.',
            'stages.*.min'          => 'Each stage ID must be at least 1.',
            'statuses.*.integer'    => 'Each status must be a valid ID.',
            'statuses.*.min'        => 'Each status ID must be at least 1.',
            'tags.*.integer'        => 'Each tag must be a valid ID.',
            'tags.*.min'            => 'Each tag ID must be at least 1.',
        ];
    }
}
