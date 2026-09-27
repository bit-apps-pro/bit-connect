<?php

namespace BitApps\BitConnect\Http\Controller;

// Prevent direct script access
if (!defined('ABSPATH')) {
    exit;
}

use BitApps\BitConnect\Config;
use BitApps\BitConnect\Deps\BitApps\WPKit\Http\Response;
use BitApps\BitConnect\Enum\GeneralSettings;
use BitApps\BitConnect\Http\Requests\GetGeneralSettingsRequest;
use BitApps\BitConnect\Http\Requests\UpdateGeneralSettingsRequest;

final class GeneralSettingsController
{
    public function get(GetGeneralSettingsRequest $_request) // phpcs:ignore VariableAnalysis.CodeAnalysis.VariableAnalysis.UnusedVariable
    {
        $settings = Config::getOption(GeneralSettings::OPTION_NAME->value, $this->getDefaultSettings());

        if (!\is_array($settings)) {
            $settings = $this->getDefaultSettings();
        }

        $settings = array_merge($this->getDefaultSettings(), $settings);
        // The card's copy is the plugin's, not stored: resolve it so the admin
        // preview shows exactly what the portal will.
        $settings['promo'] = GeneralSettings::promo($settings);

        return Response::success($settings);
    }

    public function update(UpdateGeneralSettingsRequest $request)
    {
        $data = $request->toSettingsData();

        $added = Config::addOption(GeneralSettings::OPTION_NAME->value, $data);

        if (!$added) {
            Config::updateOption(GeneralSettings::OPTION_NAME->value, $data);
        }

        return Response::success(array_merge($data, ['promo' => GeneralSettings::promo($data)]));
    }

    private function getDefaultSettings(): array
    {
        return [
            'communityTitle'      => '',
            'logoLight'           => '',
            'logoPermalinkMode'   => 'default',
            'logoPermalinkCustom' => '',
            'portalAccess'        => 'everyone',
            // Portal topic-list filter controls. Visible unless an admin turns
            // one off, so installs that predate this setting keep their toolbar.
            'portalFilters' => [
                'sort'    => true,
                'product' => true,
                'tags'    => true,
            ],
            // The Bit Apps credit card at the foot of the portal sidebar. Off
            // until an admin asks for it: it links off the owner's own public
            // pages. Its copy is fixed — see GeneralSettings::promo().
            'promo' => [
                'enabled' => false,
            ],
        ];
    }
}
