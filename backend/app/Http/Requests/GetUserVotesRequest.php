<?php

namespace BitApps\BitConnect\Http\Requests;

if (!\defined('ABSPATH')) {
    exit;
}

use BitApps\BitConnect\Deps\BitApps\WPKit\Http\Request\Request;
use BitApps\BitConnect\Services\PermissionService;

/**
 * Topics a member has upvoted.
 *
 * Request input properties.
 *
 * @property int      $id
 * @property null|int $page
 * @property null|int $per_page
 */
final class GetUserVotesRequest extends Request
{
    /**
     * Owner (or a moderator) only — unlike the rest of the profile.
     *
     * A vote is not published content: casting one says what a member thinks
     * without them choosing to say it in public, and the totals on a topic are
     * deliberately anonymous. Serving a per-member voting history to any
     * visitor would de-anonymise every one of those counts, so the list stays
     * with the person who cast the votes.
     */
    public function authorize()
    {
        $userId = (int) $this->id;

        return ($userId > 0 && get_current_user_id() === $userId) || PermissionService::canModerate();
    }

    public function failedAuthorizationMessage(): string
    {
        if (!is_user_logged_in()) {
            return 'You must be logged in to view voting activity.';
        }

        return 'You can only view your own voting activity.';
    }

    public function rules()
    {
        return [
            'id'       => ['required', 'integer', 'min:1'],
            'page'     => ['nullable', 'integer', 'min:1'],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:50'],
        ];
    }

    public function messages()
    {
        return [
            'id.required'  => 'User ID is required.',
            'id.integer'   => 'User ID must be a valid integer.',
            'per_page.max' => 'The per_page parameter cannot exceed 50.',
        ];
    }
}
