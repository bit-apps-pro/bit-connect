<?php

namespace BitApps\BitConnect\Http\Controller;

// Prevent direct script access
if (!defined('ABSPATH')) {
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
                    // The built-in form follows WordPress's own "Anyone can
                    // register". This plugin never changes that option; the
                    // screen only says it is off and links to where it is set.
                    'canRegister'           => AuthService::canRegister(),
                    'membershipSettingsUrl' => self::membershipSettingsUrl(),
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

    /**
     * The screen that holds the registration switch, or '' when the current
     * user cannot open it — managing the forum does not mean managing the site.
     */
    private static function membershipSettingsUrl(): string
    {
        if (is_multisite()) {
            return current_user_can('manage_network_options') ? network_admin_url('settings.php') : '';
        }

        return current_user_can('manage_options') ? admin_url('options-general.php') : '';
    }
}
