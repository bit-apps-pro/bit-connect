<?php

namespace BitApps\BitConnect\Http\Requests;

if (!defined('ABSPATH')) {
    exit;
}

use BitApps\BitConnect\Deps\BitApps\WPKit\Http\Request\Request;
use BitApps\BitConnect\Http\Rules\AtLeastRule;
use BitApps\BitConnect\Services\PortalAccess;

/**
 * Request input properties.
 *
 * @property string $target_type tag | forum, or one TopicTaxonomies adds
 * @property int    $target_id   0 for the forum as a whole, which has no id
 */
final class GetFollowStateRequest extends Request
{
    /**
     * Open to whoever may read the portal: the answer for a guest is a
     * constant, and a member reads only their own row. Following itself is
     * ToggleFollowRequest's to gate.
     */
    public function authorize()
    {
        return PortalAccess::canView();
    }

    public function failedAuthorizationMessage(): string
    {
        return PortalAccess::deniedMessage();
    }

    public function rules()
    {
        return [
            'target_type' => ['required', 'string'],
            // Zero is the whole forum — see ToggleFollowRequest.
            'target_id' => ['required', 'integer', new AtLeastRule(0)],
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
