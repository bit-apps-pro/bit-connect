<?php

namespace BitApps\BitConnect\Http\Middleware;

// Prevent direct script access
if (!\defined('ABSPATH')) {
    exit;
}

use BitApps\BitConnect\Deps\BitApps\WPKit\Http\Response;

/**
 * Middleware that rejects requests from unauthenticated users.
 *
 * Authentication-agnostic: only checks is_user_logged_in(), so it works
 * regardless of how the user authenticated (WooCommerce, BuddyPress, etc.).
 */
final class LoggedInMiddleware
{
    public function handle()
    {
        if (!is_user_logged_in()) {
            return Response::error('Authentication required. Please log in to continue.')
                ->httpStatus(401);
        }

        return true;
    }
}
