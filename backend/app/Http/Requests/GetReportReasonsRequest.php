<?php

namespace BitApps\BitConnect\Http\Requests;

if (!defined('ABSPATH')) {
    exit;
}

use BitApps\BitConnect\Deps\BitApps\WPKit\Http\Request\Request;
use BitApps\BitConnect\Services\PermissionService;

/**
 * The reason list a member picks from when reporting.
 *
 * Its own class rather than reusing CreateReportRequest for the authorize()
 * check: that one requires target_type, target_id and reason, so a GET carrying
 * none of them failed validation and the modal opened with an empty list and no
 * explanation. Same audience, no input to validate.
 */
final class GetReportReasonsRequest extends Request
{
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
        return [];
    }
}
