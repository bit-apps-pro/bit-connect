<?php

namespace BitApps\BitConnect\Http\Requests;

if (!defined('ABSPATH')) {
    exit;
}

use BitApps\BitConnect\Deps\BitApps\WPKit\Http\Request\Request;
use BitApps\BitConnect\Services\PermissionService;

/**
 * Request input properties.
 *
 * @property null|string $status   filter by ReportStatus value; defaults to pending
 * @property null|int    $page
 * @property null|int    $per_page
 */
final class GetReportsRequest extends Request
{
    public function authorize()
    {
        return PermissionService::canModerate();
    }

    public function failedAuthorizationMessage(): string
    {
        if (!is_user_logged_in()) {
            return 'You must be logged in to review reports.';
        }

        return 'You do not have permission to review reports.';
    }

    public function rules()
    {
        return [
            'status'   => ['nullable', 'string'],
            'page'     => ['nullable', 'integer'],
            'per_page' => ['nullable', 'integer'],
        ];
    }
}
