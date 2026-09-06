<?php

namespace BitApps\BitConnect\Http\Controller;

// Prevent direct script access
if (!defined('ABSPATH')) {
    exit;
}

use BitApps\BitConnect\Config;
use BitApps\BitConnect\Deps\BitApps\WPKit\Http\Request\Request;
use BitApps\BitConnect\Deps\BitApps\WPKit\Http\Response;
use BitApps\BitConnect\Deps\BitApps\WPTelemetry\Telemetry\Telemetry;

/**
 * Diagnostic-data consent.
 *
 * This lives in the free plugin, unlike the other Bit Apps plugins where it sits
 * in the pro add-on. It has to: Plugin::initWPTelemetry() runs here, so the free
 * plugin is what reports, and a forum with no licence would otherwise be
 * reporting with no way for its admin to see that or turn it off.
 *
 * The option is written by the telemetry package under its configured prefix,
 * which is Config::VAR_PREFIX — hence reading it back as a plain plugin option.
 */
final class PluginImprovementController
{
    public function getData()
    {
        return Response::success(
            ['allowTracking' => Config::getOption('allow_tracking')]
        );
    }

    public function createOrUpdate(Request $request)
    {
        $validatedData = (object) $request->validate(
            ['allowTracking' => ['required', 'boolean']]
        );

        // Opting in and out goes through the package rather than the option, so
        // it can do the rest of its bookkeeping — the option is only where the
        // answer happens to be stored.
        if ($validatedData->allowTracking) {
            Telemetry::report()->trackingOptIn();
        } else {
            Telemetry::report()->trackingOptOut();
        }

        return Response::success(
            ['allowTracking' => $validatedData->allowTracking]
        );
    }
}
