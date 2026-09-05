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
 * @property string      $target_type post | comment
 * @property int         $target_id
 * @property string      $reason      a ReportReasons value
 * @property null|string $details     required when the reason is "other"
 */
final class CreateReportRequest extends Request
{
    /**
     * Any member who takes part in the forum may report.
     *
     * Deliberately not a capability of its own. Reporting is how a member asks
     * for a second opinion, and putting it behind a switch an admin has to find
     * and turn on would leave most forums with no way to raise anything. The
     * rules that matter — not your own content, not twice, not in a flood —
     * live in ReportService and cannot be granted away.
     */
    public function authorize()
    {
        return PermissionService::isForumParticipant();
    }

    public function failedAuthorizationMessage(): string
    {
        if (!is_user_logged_in()) {
            return 'You must be logged in to report anything.';
        }

        return 'You do not have permission to report content on this forum.';
    }

    public function rules()
    {
        return [
            'target_type' => ['required', 'string'],
            'target_id'   => ['required', 'integer', 'min:1'],
            'reason'      => ['required', 'string'],
            'details'     => ['nullable', 'string', 'max:2000'],
        ];
    }

    public function messages()
    {
        return [
            'target_type.required' => __('What is being reported is missing.', 'bit-connect'),
            'target_id.required'   => __('What is being reported is missing.', 'bit-connect'),
            'reason.required'      => __('Please choose a reason.', 'bit-connect'),
            'details.max'          => __('Please keep the explanation under 2000 characters.', 'bit-connect'),
        ];
    }
}
