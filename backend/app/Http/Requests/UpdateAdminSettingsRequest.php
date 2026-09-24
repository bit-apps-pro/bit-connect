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

/**
 * Request input properties.
 *
 * @property array $topicAccess
 * @property array $cleanup
 * @property array $topicFormFields
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
            // belongs to whichever plugin put it there, and rebuilding the
            // array from the request would erase a setting this screen never
            // showed every time an administrator pressed Save.
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
            // No moderation group. This plugin never acts on a report by
            // itself, so it has no threshold to store.
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
