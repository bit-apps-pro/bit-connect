<?php

use BitApps\BitConnect\Config;
use BitApps\BitConnect\Deps\BitApps\WPDatabase\Connection as DB;
use BitApps\BitConnect\Deps\BitApps\WPKit\Migration\Migration;

if (!defined('ABSPATH')) {
    exit;
}

final class BitAppsConnectPluginOptions extends Migration
{
    public function up(): void
    {
        Config::updateOption('db_version', Config::DB_VERSION, true);
        Config::updateOption('installed', time(), true);
        Config::updateOption('version', Config::VERSION, true);
        Config::updateOption('app_settings', Config::VERSION, true);
        Config::addOption('onboarding_completed', false);
    }

    public function down(): void
    {
        $pluginOptions = [
            Config::withPrefix('db_version'),
            Config::withPrefix('installed'),
            Config::withPrefix('version'),
            Config::withPrefix('app_settings'),
            Config::withPrefix('tracking_notice_dismissed'),
            Config::withPrefix('tracking_skipped'),
            Config::withPrefix('portal_page'),
            Config::withPrefix('onboarding_completed'),
        ];

        DB::query(
            DB::prepare(
                'DELETE FROM `' . DB::wpPrefix() . 'options` WHERE option_name in ('
                    . implode(
                        ',',
                        array_map(
                            function () {
                                return '%s';
                            },
                            $pluginOptions
                        )
                    ) . ')',
                $pluginOptions
            )
        );
    }
}
