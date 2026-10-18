<?php

namespace BitApps\BitConnect\Http\Requests;

if (!defined('ABSPATH')) {
    exit;
}

use BitApps\BitConnect\Deps\BitApps\WPKit\Http\Request\Request;
use BitApps\BitConnect\Http\Rules\InRule;
use BitApps\BitConnect\Services\PermissionService;
use BitApps\BitConnect\Services\TopicModerationService;

/**
 * Request input properties.
 *
 * @property array<int, int> $ids
 * @property string          $action  one of TopicModerationService::ACTIONS
 * @property null|int        $term_id the status or stage, for set_status and set_stage
 */
final class BulkTopicActionRequest extends Request
{
    /**
     * Most ids one request may act on.
     *
     * Every topic is a full post save, and a status change notifies its thread,
     * so a request has to finish well inside a PHP time limit. The table sends
     * a larger selection in pieces.
     */
    public const MAX_IDS = 50;

    /**
     * bit_connect_forum_moderate for the request. Lock and delete each need
     * their own capability on top — checked in the controller, where the
     * action is known.
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
        return [
            'ids'     => ['required', 'array', 'min:1', 'max:' . self::MAX_IDS],
            'ids.*'   => ['required', 'integer', 'min:1'],
            'action'  => ['required', 'string', new InRule(TopicModerationService::ACTIONS)],
            'term_id' => ['nullable', 'integer', 'min:1'],
        ];
    }

    public function messages()
    {
        return [
            'ids.required'    => 'Choose at least one post.',
            'ids.max'         => \sprintf('At most %d posts can be changed at once.', self::MAX_IDS),
            'ids.*.integer'   => 'Each post must be a valid ID.',
            'action.required' => 'Choose what to do with the posts.',
            'term_id.integer' => 'The status or stage must be a valid ID.',
        ];
    }
}
