<?php

namespace BitApps\BitConnect\Http\Requests;

if (!\defined('ABSPATH')) {
    exit;
}

use BitApps\BitConnect\Deps\BitApps\WPKit\Http\Request\Request;

/**
 * Request input properties.
 *
 * There is no user id here, and there must never be one: the controller reads
 * get_current_user_id(). An endpoint that took a member id would need a check
 * saying "unless it is someone else's", and that check is the sort of thing that
 * gets refactored away. Not offering the parameter removes the bug class.
 *
 * @property null|int  $page
 * @property null|int  $per_page
 * @property null|bool $unread show only what they have not read
 */
final class GetNotificationsRequest extends Request
{
    /**
     * Logged in is the whole requirement.
     *
     * Deliberately not isForumParticipant(), which every other member-facing
     * request in this plugin uses. A member whose posting capabilities were
     * withdrawn after moderation is precisely the person with an unread notice
     * explaining why, and gating their own inbox on the capabilities they just
     * lost would take the explanation away with them.
     */
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
            'page'     => ['nullable', 'integer'],
            'per_page' => ['nullable', 'integer'],
            'unread'   => ['nullable', 'boolean'],
        ];
    }
}
