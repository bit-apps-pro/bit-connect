<?php

namespace BitApps\BitConnect\Http\Requests;

if (!defined('ABSPATH')) {
    exit;
}

use BitApps\BitConnect\Deps\BitApps\WPKit\Http\Request\Request;
use BitApps\BitConnect\Deps\BitApps\WPKit\Utils\Capabilities as WpCapabilities;
use BitApps\BitConnect\Enum\Capabilities;

/**
 * Request input properties.
 *
 * @property int $id
 */
final class ToggleCommentVoteRequest extends Request
{
    public function authorize()
    {
        return WpCapabilities::check(Capabilities::VOTE_COMMENT->value);
    }

    public function failedAuthorizationMessage(): string
    {
        if (!is_user_logged_in()) {
            return 'You must be logged in to vote on a comment.';
        }

        return 'You do not have permission to vote on a comment.';
    }

    public function rules()
    {
        return [
            'id' => ['required', 'integer', 'min:1'],
        ];
    }

    public function messages()
    {
        return [
            'id.required' => __('Comment ID is required.', 'bit-connect'),
            'id.integer'  => __('Comment ID must be a valid integer.', 'bit-connect'),
        ];
    }
}
