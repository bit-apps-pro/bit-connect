<?php

namespace BitApps\BitConnect\Http\Requests;

if (!defined('ABSPATH')) {
    exit;
}

use BitApps\BitConnect\Deps\BitApps\WPKit\Http\Request\Request;
use BitApps\BitConnect\Deps\BitApps\WPKit\Utils\Capabilities;
use BitApps\BitConnect\Services\AuthService;
use BitApps\BitConnect\Services\ReportService;

/**
 * Request input properties.
 *
 * @property array      $topicAccess
 * @property array      $cleanup
 * @property array      $topicFormFields
 * @property null|array $moderation
 */
final class UpdateAdminSettingsRequest extends Request
{
    public function authorize()
    {
        return Capabilities::check(AuthService::CAP_MANAGE);
    }

    public function failedAuthorizationMessage(): string
    {
        if (!is_user_logged_in()) {
            return 'You must be logged in to update admin settings.';
        }

        return 'You do not have permission to update admin settings.';
    }

    public function rules()
    {
        return [
            'topicAccess'     => ['required', 'array'],
            'cleanup'         => ['required', 'array'],
            'topicFormFields' => ['required', 'array'],
            // Optional so an older admin bundle, which knows nothing about it,
            // does not have its save rejected outright.
            'moderation' => ['nullable', 'array'],
        ];
    }

    public function messages()
    {
        return [
            'topicAccess.required'     => 'topicAccess is required.',
            'topicAccess.array'        => 'topicAccess must be an object.',
            'cleanup.required'         => 'cleanup is required.',
            'cleanup.array'            => 'cleanup must be an object.',
            'topicFormFields.required' => 'topicFormFields is required.',
            'topicFormFields.array'    => 'topicFormFields must be an object.',
        ];
    }

    public function toSettingsData(): array
    {
        return [
            'topicAccess' => [
                'comment'       => (bool) ($this->topicAccess['comment'] ?? false),
                'commentUpvote' => (bool) ($this->topicAccess['commentUpvote'] ?? false),
                'upvote'        => (bool) ($this->topicAccess['upvote'] ?? false),
                'privateTopic'  => (bool) ($this->topicAccess['privateTopic'] ?? false),
            ],
            'cleanup' => [
                'deleteDataOnUninstall' => (bool) ($this->cleanup['deleteDataOnUninstall'] ?? false),
            ],
            'topicFormFields' => [
                'requireTopicType'  => (bool) ($this->topicFormFields['requireTopicType'] ?? true),
                'requireDepartment' => (bool) ($this->topicFormFields['requireDepartment'] ?? true),
            ],
            'moderation' => [
                // Floored at 1 and capped so a typo cannot switch auto-hiding
                // off by making it unreachable — a threshold of 900 reads as
                // "on" in the settings screen and behaves as "never".
                'autoHideThreshold' => max(
                    1,
                    min(20, (int) ($this->moderation['autoHideThreshold'] ?? ReportService::DEFAULT_AUTO_HIDE_THRESHOLD))
                ),
            ],
        ];
    }
}
