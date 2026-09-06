<?php

namespace BitApps\BitConnect\Http\Requests;

if (!defined('ABSPATH')) {
    exit;
}

use BitApps\BitConnect\Deps\BitApps\WPKit\Http\Request\Request;
use BitApps\BitConnect\Services\PortalAccess;

/**
 * Provides validation for getting all topics.
 *
 * @property null|string $search
 * @property null|string $sortBy
 * @property null|int $page
 * @property null|int $per_page
 * @property null|string $stages
 * @property null|string $departments
 * @property null|string $topic-types
 * @property null|string $statuses
 * @property null|string $tags
 * @property null|string $visibility
 * @property null|string $my_topics
 */
final class GetAllTopicsRequest extends Request
{
    /**
     * The forum's main read. It had no authorize() at all, which meant a
     * members-only forum still handed its whole topic list — titles and bodies
     * — to anonymous callers. Statuses are a separate question and already
     * handled: TopicService passes `perm => readable`, so private and hidden
     * topics never leak regardless of this gate.
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
            'search'      => ['nullable', 'string', 'sanitize:text', 'max:200'],
            'name'        => ['nullable', 'string', 'sanitize:text', 'max:200'],
            'sortBy'      => ['nullable', 'string', 'sanitize:text', 'max:50'],
            'page'        => ['nullable', 'integer', 'min:1'],
            'per_page'    => ['nullable', 'integer', 'min:1', 'max:100'],
            'stages'      => ['nullable', 'string', 'sanitize:text', 'max:200'],
            'departments' => ['nullable', 'string', 'sanitize:text', 'max:200'],
            'topic-types' => ['nullable', 'string', 'sanitize:text', 'max:200'],
            'statuses'    => ['nullable', 'string', 'sanitize:text', 'max:200'],
            'tags'        => ['nullable', 'string', 'sanitize:text', 'max:200'],
            'visibility'  => ['nullable', 'string', 'sanitize:text', 'max:20'],
            'my_topics'   => ['nullable', 'string', 'sanitize:text', 'max:5'],
        ];
    }

    public function messages()
    {
        return [
            'search.max'      => 'The search parameter cannot exceed 200 characters.',
            'sortBy.in'       => 'The sort by parameter must be either newest or oldest.',
            'page.min'        => 'The page parameter must be at least 1.',
            'per_page.min'    => 'The per_page parameter must be at least 1.',
            'per_page.max'    => 'The per_page parameter cannot exceed 100.',
            'stages.max'      => 'The stages parameter cannot exceed 200 characters.',
            'departments.max' => 'The departments parameter cannot exceed 200 characters.',
            'topic-types.max' => 'The topic-types parameter cannot exceed 200 characters.',
            'statuses.max'    => 'The statuses parameter cannot exceed 200 characters.',
            'tags.max'        => 'The tags parameter cannot exceed 200 characters.',
        ];
    }
}
