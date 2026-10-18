<?php

namespace BitApps\BitConnect\Http\Requests;

if (!defined('ABSPATH')) {
    exit;
}

use BitApps\BitConnect\Deps\BitApps\WPKit\Http\Request\Request;
use BitApps\BitConnect\Http\Rules\InRule;
use BitApps\BitConnect\Services\PermissionService;
use BitApps\BitConnect\Services\TopicModerationService;
use BitApps\BitConnect\Services\TopicTaxonomies;

/**
 * Request input properties.
 *
 * @property null|int    $page
 * @property null|int    $per_page
 * @property null|string $search
 * @property null|int    $status     a status term id
 * @property null|int    $stage      a stage term id
 * @property null|int    $topic_type a topic type term id
 * @property null|int    $author_id
 * @property null|string $visibility public | private | hidden
 * @property null|string $orderby
 * @property null|string $order      asc | desc
 * @property null|string $view       a named list another plugin answers
 */
final class ListModerationTopicsRequest extends Request
{
    /**
     * A moderation table, so bit_connect_forum_moderate — the same gate as the
     * reports queue and the activity log.
     */
    public function authorize()
    {
        return PermissionService::canModerate();
    }

    public function failedAuthorizationMessage(): string
    {
        if (!is_user_logged_in()) {
            return 'You must be logged in to moderate posts.';
        }

        return 'You do not have permission to moderate posts.';
    }

    public function rules()
    {
        $rules = [
            'page'       => ['nullable', 'integer', 'min:1'],
            'per_page'   => ['nullable', 'integer', 'min:1', 'max:100'],
            'search'     => ['nullable', 'string', 'sanitize:text', 'max:200'],
            'status'     => ['nullable', 'integer', 'min:1'],
            'stage'      => ['nullable', 'integer', 'min:1'],
            'topic_type' => ['nullable', 'integer', 'min:1'],
            // Not `author`: WordPress reads that from the query string as an
            // author archive and answers its own 404 page before the REST
            // route runs.
            'author_id'  => ['nullable', 'integer', 'min:1'],
            'visibility' => ['nullable', 'string', new InRule(TopicModerationService::VISIBILITIES)],
            'orderby'    => ['nullable', 'string', new InRule(TopicModerationService::ORDER_BY)],
            'order'      => ['nullable', 'string', new InRule(['asc', 'desc'])],
            'view'       => ['nullable', 'string', 'sanitize:key', 'max:40'],
        ];

        // A taxonomy another plugin files topics under — see TopicTaxonomies.
        foreach (array_keys(TopicTaxonomies::all()) as $param) {
            $rules[$param] = ['nullable', 'integer', 'min:1'];
        }

        return $rules;
    }
}
