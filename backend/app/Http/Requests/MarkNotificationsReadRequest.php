<?php

namespace BitApps\BitConnect\Http\Requests;

if (!defined('ABSPATH')) {
    exit;
}

use BitApps\BitConnect\Deps\BitApps\WPKit\Http\Request\Request;

/**
 * Request input properties.
 *
 * Ids are not validated for ownership here, and do not need to be:
 * NotificationService::markRead() puts `user_id` in the WHERE clause every time,
 * so an id belonging to somebody else matches no row rather than marking their
 * mail read. Enforced in the query rather than in a check the caller could skip.
 *
 * @property null|array $ids notification ids to mark read
 * @property null|bool  $all mark everything unread as read
 */
final class MarkNotificationsReadRequest extends Request
{
    public function authorize()
    {
        return is_user_logged_in();
    }

    public function failedAuthorizationMessage(): string
    {
        return 'You must be logged in to read your notifications.';
    }

    public function rules()
    {
        return [
            'ids' => ['nullable', 'array'],
            'all' => ['nullable', 'boolean'],
        ];
    }
}
