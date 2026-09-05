<?php

namespace BitApps\BitConnect\Http\Middleware;

// Prevent direct script access
if (!\defined('ABSPATH')) {
    exit;
}


use BitApps\BitConnect\Config;
use BitApps\BitConnect\Deps\BitApps\WPKit\Http\Request\Request;
use BitApps\BitConnect\Deps\BitApps\WPKit\Http\Response;

final class NonceCheckerMiddleware
{
    public function handle(Request $request)
    {
        if (!$request->has('_ajax_nonce') || !wp_verify_nonce(sanitize_key($request->_ajax_nonce), Config::withPrefix('nonce'))) {
            return Response::error('Invalid nonce token')->httpStatus(411);
        }

        return true;
    }
}
