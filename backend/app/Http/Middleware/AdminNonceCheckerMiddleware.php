<?php

namespace BitApps\BitConnect\Http\Middleware;

// Prevent direct script access
if (!defined('ABSPATH')) {
    exit;
}

use BitApps\BitConnect\Deps\BitApps\WPKit\Http\Request\Request;
use BitApps\BitConnect\Deps\BitApps\WPKit\Http\Response;
use BitApps\BitConnect\Deps\BitApps\WPKit\Utils\Capabilities;
use BitApps\BitConnect\Services\AuthService;

/**
 * Administrator, with a nonce.
 *
 * Distinct from the existing `nonce` middleware, which checks the plugin's own
 * nonce: the admin app is given a `wp_rest` nonce (see Head::createConfigVariable)
 * and that is what the shared components send, so an endpoint they call has to
 * verify against that one instead.
 *
 * Distinct from `isAdmin` too, which checks the capability and nothing else. A
 * capability alone leaves an admin open to being walked into the request from
 * another site; anything that writes needs both.
 */
final class AdminNonceCheckerMiddleware
{
    public function handle(Request $request)
    {
        if (!Capabilities::check(AuthService::CAP_MANAGE)) {
            return Response::error(
                __('Access Denied: Only administrators are allowed to make this request', 'bit-connect')
            )->httpStatus(403);
        }

        $nonce = '';

        if ($request->has('_ajax_nonce')) {
            $nonce = sanitize_key($request->_ajax_nonce);
        } elseif (isset($_SERVER['HTTP_X_WP_NONCE'])) {
            $nonce = sanitize_key(wp_unslash($_SERVER['HTTP_X_WP_NONCE']));
        }

        if ($nonce === '' || !wp_verify_nonce($nonce, 'wp_rest')) {
            return Response::error(__('Invalid nonce token', 'bit-connect'))->httpStatus(411);
        }

        return true;
    }
}
