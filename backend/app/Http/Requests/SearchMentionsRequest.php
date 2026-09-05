<?php

namespace BitApps\BitConnect\Http\Requests;

if (!\defined('ABSPATH')) {
    exit;
}

use BitApps\BitConnect\Deps\BitApps\WPKit\Http\Request\Request;

/**
 * Request input properties.
 *
 * @property null|string $q what the author has typed after the "@"
 */
final class SearchMentionsRequest extends Request
{
    /**
     * Logged in is the whole requirement.
     *
     * Deliberately not the posting capability this feeds: the picker also opens
     * in an edit box, and a member whose posting rights were withdrawn mid-draft
     * should get an empty list from the search rather than a failed request they
     * cannot explain. What it returns — display name, avatar, profile URL — is
     * already public on every topic and comment they have written, so login is a
     * gate on volume, not on secrets.
     */
    public function authorize()
    {
        return is_user_logged_in();
    }

    public function failedAuthorizationMessage(): string
    {
        return 'You must be logged in to mention someone.';
    }

    public function rules()
    {
        return [
            'q' => ['nullable', 'string', 'sanitize:text', 'max:60'],
        ];
    }
}
