<?php

namespace BitApps\BitConnect\Http\Controller;

// Prevent direct script access
if (!defined('ABSPATH')) {
    exit;
}

use BitApps\BitConnect\Config;
use BitApps\BitConnect\Deps\BitApps\WPKit\Http\Response;
use BitApps\BitConnect\Http\Requests\CompleteOnboardingRequest;
use BitApps\BitConnect\Http\Requests\GetOnboardingStatusRequest;

final class OnboardingController
{
    public function status(GetOnboardingStatusRequest $_request) // phpcs:ignore VariableAnalysis.CodeAnalysis.VariableAnalysis.UnusedVariable
    {
        $completed = Config::getOption('onboarding_completed', false);

        return Response::success(['completed' => (bool) $completed]);
    }

    public function complete(CompleteOnboardingRequest $_request) // phpcs:ignore VariableAnalysis.CodeAnalysis.VariableAnalysis.UnusedVariable
    {
        Config::updateOption('onboarding_completed', true);

        return Response::success(['completed' => true]);
    }
}
