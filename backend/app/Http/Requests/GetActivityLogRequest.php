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
 * @property null|int    $actor       filter to one actor
 * @property null|string $action      filter to one action slug
 * @property null|string $target_type post | comment
 * @property null|int    $page
 * @property null|int    $per_page
 */
final class GetActivityLogRequest extends Request
{
    /**
     * Gated on forum_moderate rather than forum_manage.
     *
     * The log is a moderation tool, so it answers to the moderation capability
     * rather than the admin one — a moderator reviewing what was done to a
     * member's post should not need the keys to the settings screens.
     */
    public function authorize()
    {
        return PermissionService::canModerate();
    }

    public function failedAuthorizationMessage(): string
    {
        if (!is_user_logged_in()) {
            return 'You must be logged in to view the activity log.';
        }

        return 'You do not have permission to view the activity log.';
    }

    public function rules()
    {
        return [
            'actor'       => ['nullable', 'integer'],
            'action'      => ['nullable', 'string'],
            'target_type' => ['nullable', 'string'],
            'target_id'   => ['nullable', 'integer'],
            'page'        => ['nullable', 'integer'],
            'per_page'    => ['nullable', 'integer'],
        ];
    }
}
