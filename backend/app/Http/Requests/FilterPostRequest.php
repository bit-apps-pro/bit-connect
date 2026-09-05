<?php

namespace BitApps\BitConnect\Http\Requests;

if (!\defined('ABSPATH')) {
    exit;
}

use BitApps\BitConnect\Deps\BitApps\WPKit\Http\Request\Request;
use BitApps\BitConnect\Deps\BitApps\WPKit\Utils\Capabilities;
use BitApps\BitConnect\Services\AuthService;

/**
 * Provides validation for filtering posts.
 *
 * @property null|string $stages
 * @property null|string $departments
 * @property null|string $topic-types
 * @property null|string $statuses
 * @property null|string $tags
 */
final class FilterPostRequest extends Request
{
    public function authorize()
    {
        return Capabilities::check(AuthService::CAP_MANAGE);
    }

    public function rules()
    {
        return [
            'stages'      => ['nullable', 'string', 'sanitize:text', 'max:200'],
            'departments' => ['nullable', 'string', 'sanitize:text', 'max:200'],
            'topic-types' => ['nullable', 'string', 'sanitize:text', 'max:200'],
            'statuses'    => ['nullable', 'string', 'sanitize:text', 'max:200'],
            'tags'        => ['nullable', 'string', 'sanitize:text', 'max:200'],
        ];
    }

    public function messages()
    {
        return [
            'stages.max'      => 'The stages parameter cannot exceed 200 characters.',
            'departments.max' => 'The departments parameter cannot exceed 200 characters.',
            'topic-types.max' => 'The topic-types parameter cannot exceed 200 characters.',
            'statuses.max'    => 'The statuses parameter cannot exceed 200 characters.',
            'tags.max'        => 'The tags parameter cannot exceed 200 characters.',
        ];
    }
}
