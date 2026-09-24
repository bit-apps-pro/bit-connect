<?php

namespace BitApps\BitConnect\Http\Controller;

// Prevent direct script access
if (!defined('ABSPATH')) {
    exit;
}

use BitApps\BitConnect\Config;
use BitApps\BitConnect\Deps\BitApps\WPKit\Http\Response;
use BitApps\BitConnect\Deps\BitApps\WPKit\Utils\Capabilities as WpCapabilities;
use BitApps\BitConnect\Enum\AdminSettings;
use BitApps\BitConnect\Enum\Capabilities;
use BitApps\BitConnect\Http\Requests\GetAdminSettingsRequest;
use BitApps\BitConnect\Http\Requests\UpdateAdminSettingsRequest;

final class AdminSettingsController
{
    public function get(GetAdminSettingsRequest $_request) // phpcs:ignore VariableAnalysis.CodeAnalysis.VariableAnalysis.UnusedVariable
    {
        $settings = Config::getOption(AdminSettings::OPTION_NAME->value, $this->getDefaultSettings());

        if (!\is_array($settings) || !isset($settings['topicAccess'])) {
            $settings = $this->getDefaultSettings();
        }

        $defaults = $this->getDefaultSettings();
        // Built from the groups this plugin implements and nothing else. The
        // stored option may hold more — another plugin may keep its own keys
        // under topicAccess, and an older build of this plugin wrote a
        // `moderation` group — but neither is a setting this plugin acts on,
        // so neither is reported: a flag here for a feature this plugin does
        // not implement would describe a control that has nothing behind it.
        $response = [
            'topicAccess' => array_merge(
                $defaults['topicAccess'],
                array_intersect_key(
                    \is_array($settings['topicAccess'] ?? null) ? $settings['topicAccess'] : [],
                    $defaults['topicAccess']
                )
            ),
            'cleanup' => array_merge(
                $defaults['cleanup'],
                \is_array($settings['cleanup'] ?? null) ? $settings['cleanup'] : []
            ),
            'topicFormFields' => array_merge(
                $defaults['topicFormFields'],
                \is_array($settings['topicFormFields'] ?? null) ? $settings['topicFormFields'] : []
            ),
        ];

        // The portal reads this endpoint too — it builds the topic form and
        // decides which controls to draw from `topicAccess` and
        // `topicFormFields`. It has no use for `cleanup`, which describes what
        // an uninstall will destroy, so that stays with the administrators.
        if (!WpCapabilities::check(Capabilities::MANAGE->value)) {
            return Response::success(
                [
                    'topicAccess'     => $response['topicAccess'],
                    'topicFormFields' => $response['topicFormFields'],
                ]
            );
        }

        return Response::success($response);
    }

    public function update(UpdateAdminSettingsRequest $request)
    {
        $settingsData = $request->toSettingsData();

        // update_option creates the option if it doesn't exist and returns false
        // when the value is unchanged — both cases are success.
        Config::updateOption(AdminSettings::OPTION_NAME->value, $settingsData);

        return Response::success($settingsData);
    }

    /**
     * What a forum that has never saved this screen runs on.
     *
     * These groups are the whole of this screen as this plugin knows it. There
     * is no moderation group and no switch for upvoting individual replies or
     * for private topics, and none is missing either — none of those is
     * implemented here, so there is nothing for a setting to control.
     */
    private function getDefaultSettings()
    {
        return [
            'topicAccess' => [
                'comment' => true,
                'upvote'  => true,
            ],
            'cleanup' => [
                'deleteDataOnUninstall' => false,
            ],
            'topicFormFields' => [
                'requireTopicType'  => true,
                'requireDepartment' => true,
            ],
        ];
    }
}
