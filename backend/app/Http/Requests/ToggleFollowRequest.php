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
 * @property string $target_type topic | department | tag | forum
 * @property int    $target_id   0 for the forum as a whole, which has no id
 * @property bool   $follow      true to follow, false to mute
 */
final class ToggleFollowRequest extends Request
{
    /**
     * Following is open to any forum participant.
     *
     * Not a capability of its own, for the same reason reporting is not (see
     * CreateReportRequest): asking to hear about a thread is not a power, and
     * putting it behind a switch an admin has to find would leave most forums
     * with a notification system nobody is subscribed to.
     */
    public function authorize()
    {
        return PermissionService::isForumParticipant();
    }

    public function failedAuthorizationMessage(): string
    {
        if (!is_user_logged_in()) {
            return 'You must be logged in to follow anything.';
        }

        return 'You do not have permission to take part in this forum.';
    }

    public function rules()
    {
        return [
            'target_type' => ['required', 'string'],
            // Zero is legitimate — it is how "the whole forum" is stored, since
            // it has no row of its own to point at. min:0 rather than min:1.
            'target_id' => ['required', 'integer', 'min:0'],
            'follow'    => ['required', 'boolean'],
        ];
    }

    public function messages()
    {
        return [
            'target_type.required' => __('What is being followed is missing.', 'bit-connect'),
            'target_id.required'   => __('What is being followed is missing.', 'bit-connect'),
        ];
    }
}
