<?php

namespace BitApps\BitConnect\Http\Requests;

if (!\defined('ABSPATH')) {
    exit;
}

use BitApps\BitConnect\Deps\BitApps\WPKit\Http\Request\Request;

/**
 * Request input properties.
 *
 * Answers for whoever is logged in — there is no member id, for the same reason
 * GetNotificationsRequest has none.
 *
 * @property null|string $target_type which kind of follow to list; defaults to topics
 * @property null|int    $page
 * @property null|int    $per_page
 */
final class GetFollowsRequest extends Request
{
    public function authorize()
    {
        return is_user_logged_in();
    }

    public function failedAuthorizationMessage(): string
    {
        return 'You must be logged in to see what you follow.';
    }

    public function rules()
    {
        return [
            'target_type' => ['nullable', 'string'],
            'page'        => ['nullable', 'integer'],
            'per_page'    => ['nullable', 'integer'],
        ];
    }
}
