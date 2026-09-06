<?php

namespace BitApps\BitConnect\Http\Middleware;

// Prevent direct script access
if (!defined('ABSPATH')) {
    exit;
}


use BitApps\BitConnect\Deps\BitApps\WPKit\Http\Response;
use BitApps\BitConnect\Deps\BitApps\WPKit\Utils\Capabilities;
use BitApps\BitConnect\Services\AuthService;

final class AdminCheckerMiddleware
{
    public function handle()
    {
        if (!Capabilities::check(AuthService::CAP_MANAGE)) {
            return Response::error('Access Denied: Only administrators or forum moderators are allowed to make this request')->httpStatus(411);
        }

        return true;
    }
}
