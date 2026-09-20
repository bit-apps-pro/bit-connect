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
use BitApps\BitConnect\Services\PermissionService;
use BitApps\BitConnect\Services\ReportService;

final class AdminSettingsController
{
    public function get(GetAdminSettingsRequest $_request) // phpcs:ignore VariableAnalysis.CodeAnalysis.VariableAnalysis.UnusedVariable
    {
        $settings = Config::getOption(AdminSettings::OPTION_NAME->value, $this->getDefaultSettings());

        if (!\is_array($settings) || !isset($settings['topicAccess'])) {
            $settings = $this->getDefaultSettings();
        }

        $defaults = $this->getDefaultSettings();
        $settings['topicAccess'] = array_merge(
            $defaults['topicAccess'],
            $settings['topicAccess'] ?? [],
            // Private topics are not in this payload at all: the feature ships
            // in the Bit Connect Pro add-on, endpoint and all, and the add-on
            // tells the portal about its own. Reporting a flag here for a
            // feature this plugin does not implement would describe a control
            // that has nothing behind it.
            [
                // Same again: the portal decides whether to draw the upvote
                // control on a comment from this payload, so reporting the
                // stored value alone would draw a button the server refuses.
                'commentUpvote' => PermissionService::canUseCommentUpvotes(),
            ]
        );
        $settings['cleanup'] = array_merge(
            $defaults['cleanup'],
            $settings['cleanup'] ?? []
        );
        $settings['topicFormFields'] = array_merge(
            $defaults['topicFormFields'],
            $settings['topicFormFields'] ?? []
        );
        // Reported through the service rather than read straight from the array,
        // so the screen shows the number that will actually be applied — the
        // filter and the legacy standalone option both feed into it.
        $settings['moderation'] = array_merge(
            $defaults['moderation'],
            $settings['moderation'] ?? [],
            ['autoHideThreshold' => ReportService::autoHideThreshold()]
        );

        // The portal reads this endpoint too — it builds the topic form and
        // decides which controls to draw from `topicAccess` and
        // `topicFormFields`. It has no use for the rest, and the rest is worth
        // withholding: `moderation.autoHideThreshold` tells a would-be abuser
        // exactly how many reports it takes to bury someone else's topic, and
        // `cleanup` describes what an uninstall will destroy.
        if (!WpCapabilities::check(Capabilities::MANAGE->value)) {
            return Response::success(
                [
                    'topicAccess'     => $settings['topicAccess'],
                    'topicFormFields' => $settings['topicFormFields'],
                ]
            );
        }

        return Response::success($settings);
    }

    public function update(UpdateAdminSettingsRequest $request)
    {
        $settingsData = $request->toSettingsData();

        // update_option creates the option if it doesn't exist and returns false
        // when the value is unchanged — both cases are success.
        Config::updateOption(AdminSettings::OPTION_NAME->value, $settingsData);

        return Response::success($settingsData);
    }

    private function getDefaultSettings()
    {
        return [
            'topicAccess' => [
                'comment'       => true,
                'commentUpvote' => true,
                'upvote'        => true,
            ],
            'cleanup' => [
                'deleteDataOnUninstall' => false,
            ],
            'topicFormFields' => [
                'requireTopicType'  => true,
                'requireDepartment' => true,
            ],
            'moderation' => [
                'autoHideThreshold' => ReportService::DEFAULT_AUTO_HIDE_THRESHOLD,
            ],
        ];
    }
}
