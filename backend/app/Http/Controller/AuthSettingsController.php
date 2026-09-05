<?php

namespace BitApps\BitConnect\Http\Controller;

// Prevent direct script access
if (!\defined('ABSPATH')) {
    exit;
}

use BitApps\BitConnect\Config;
use BitApps\BitConnect\Deps\BitApps\WPKit\Http\Response;
use BitApps\BitConnect\Enum\AuthSettings;
use BitApps\BitConnect\Http\Requests\GetAuthSettingsRequest;
use BitApps\BitConnect\Http\Requests\UpdateAuthSettingsRequest;
use BitApps\BitConnect\Services\AuthService;

final class AuthSettingsController
{
    public function get(GetAuthSettingsRequest $_request) // phpcs:ignore VariableAnalysis.CodeAnalysis.VariableAnalysis.UnusedVariable
    {
        $forumUrl = AuthService::getForumPageUrl();

        return Response::success(
            array_merge(
                AuthService::getSettings(),
                [
                    'loginPageUrl'        => $forumUrl . '/login',
                    'registrationPageUrl' => $forumUrl . '/register',
                    'availableRoles'      => AuthService::assignableRoles(),
                ]
            )
        );
    }

    public function update(UpdateAuthSettingsRequest $request)
    {
        $urlErrors = $request->customUrlErrors();

        if (!empty($urlErrors)) {
            return Response::error($urlErrors)
                ->code('VALIDATION')
                ->httpStatus(422);
        }

        $data = $request->toSettingsData();

        $added = Config::addOption(AuthSettings::OPTION_NAME->value, $data);

        if (!$added) {
            Config::updateOption(AuthSettings::OPTION_NAME->value, $data);
        }

        return Response::success($data);
    }
}
