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
 * @property string      $status      the ReportStatus to close them with
 * @property null|string $note        why, kept on every report closed
 */
final class ResolveReportRequest extends Request
{
    /**
     * Reviewing is forum_moderate.
     *
     * Resolving as "removed" deletes the content, and that needs forum_delete_any
     * on top — checked in the controller, where the decision being made is known.
     * A moderator without the red pen still works the queue: they can keep
     * content or dismiss the report, and are refused only the ending that
     * destroys someone's words.
     */
    public function authorize()
    {
        return PermissionService::canModerate();
    }

    public function failedAuthorizationMessage(): string
    {
        if (!is_user_logged_in()) {
            return 'You must be logged in to resolve reports.';
        }

        return 'You do not have permission to resolve reports.';
    }

    public function rules()
    {
        return [
            'target_type' => ['required', 'string'],
            'target_id'   => ['required', 'integer', 'min:1'],
            'status'      => ['required', 'string'],
            'note'        => ['nullable', 'string', 'max:2000'],
        ];
    }
}
