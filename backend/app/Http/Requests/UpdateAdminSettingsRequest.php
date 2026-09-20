<?php

namespace BitApps\BitConnect\Http\Requests;

if (!defined('ABSPATH')) {
    exit;
}

use BitApps\BitConnect\Config;
use BitApps\BitConnect\Deps\BitApps\WPKit\Http\Request\Request;
use BitApps\BitConnect\Deps\BitApps\WPKit\Utils\Capabilities;
use BitApps\BitConnect\Enum\AdminSettings;
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
            // This plugin reads only the two keys it implements off the
            // request, and writes them over whatever is already stored rather
            // than replacing the group. Anything else under topicAccess
            // belongs to a plugin that is not this one — the add-on keeps its
            // own switches here — and rebuilding the array from the request
            // would erase a setting this screen never showed every time an
            // administrator pressed Save.
            'topicAccess' => array_merge(
                self::storedTopicAccess(),
                [
                    'comment' => (bool) ($this->topicAccess['comment'] ?? false),
                    'upvote'  => (bool) ($this->topicAccess['upvote'] ?? false),
                ]
            ),
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

    /**
     * The Topic Access group as it is stored right now.
     *
     * Read so a save can be written over it rather than in place of it. This
     * plugin owns two of the keys in there and must not assume it owns the
     * rest; see toSettingsData().
     */
    private static function storedTopicAccess(): array
    {
        $stored = Config::getOption(AdminSettings::OPTION_NAME->value, []);

        if (!\is_array($stored) || !\is_array($stored['topicAccess'] ?? null)) {
            return [];
        }

        return $stored['topicAccess'];
    }
}
