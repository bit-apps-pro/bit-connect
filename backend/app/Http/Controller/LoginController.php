<?php

namespace BitApps\BitConnect\Http\Controller;

// Prevent direct script access
if (!defined('ABSPATH')) {
    exit;
}

use BitApps\BitConnect\Deps\BitApps\WPKit\Hooks\Hooks;
use BitApps\BitConnect\Deps\BitApps\WPKit\Http\Response;
use BitApps\BitConnect\Http\Requests\AjaxLoginRequest;
use BitApps\BitConnect\Services\AuthRateLimiter;
use BitApps\BitConnect\Services\AuthService;
use BitApps\BitConnect\Services\ProfileSlugService;

final class LoginController
{
    /**
     * Returns login/logout URLs and current auth state for the frontend.
     * This endpoint is public (no auth required) so the client can bootstrap.
     */
    public function data()
    {
        $isLoggedIn = AuthService::isLoggedIn();
        $currentUrl = esc_url_raw(home_url(add_query_arg([])));
        $loginUrl = AuthService::getLoginUrl($currentUrl);
        $logoutUrl = AuthService::getLogoutUrl(AuthService::getLogoutRedirect());

        $payload = [
            'isLoggedIn'  => $isLoggedIn,
            'mode'        => AuthService::getMode(),
            'loginUrl'    => $loginUrl,
            'logoutUrl'   => $logoutUrl,
            'canRegister' => AuthService::canRegister(),
            'registerUrl' => wp_registration_url(),
            'nonce'       => wp_create_nonce('bit_connect_ajax_login'),
        ];

        if ($isLoggedIn) {
            $user = AuthService::getCurrentUser();
            $roles = \is_array($user->roles ?? null) ? array_values($user->roles) : [];

            $payload['user'] = [
                'id'           => $user->ID,
                'username'     => $user->user_login,
                'slug'         => ProfileSlugService::slugFor($user->ID),
                'email'        => $user->user_email,
                'display_name' => $user->display_name,
                'avatar'       => get_avatar_url($user->ID),
                'role'         => $roles[0] ?? null,
                'roles'        => $roles,
                'hasForumRole' => AuthService::hasForumRole($user->ID),
            ];
        }

        return Response::success($payload);
    }

    /**
     * AJAX modal login handler — uses wp_signon() exclusively.
     * Only active when mode = 'modal'.
     */
    public function login(AjaxLoginRequest $request)
    {
        if (AuthService::isCustomUrlMode()) {
            return Response::error('Plugin login is disabled. Use the configured custom login page.')
                ->httpStatus(403);
        }

        $username = (string) $request->username;

        // The same limiter and the same buckets as the REST endpoint: these are
        // two doors onto one wp_signon(), and a limit either could be counted
        // against separately would be no limit at all.
        if (!AuthRateLimiter::isAllowed(AuthRateLimiter::LOGIN, $username)) {
            return Response::error(AuthRateLimiter::errorMessage(AuthRateLimiter::LOGIN))
                ->httpStatus(429);
        }

        $user = AuthService::login(
            $username,
            (string) $request->password,
            (bool) ($request->rememberMe ?? false)
        );

        if (is_wp_error($user)) {
            AuthRateLimiter::consume(AuthRateLimiter::LOGIN, $username);

            return Response::error($user->get_error_message())
                ->httpStatus(401);
        }

        AuthRateLimiter::forget(AuthRateLimiter::LOGIN, $username);

        $roles = \is_array($user->roles ?? null) ? array_values($user->roles) : [];
        $redirect = AuthService::getLoginRedirect();

        /*
         * Fires after a successful AJAX forum login.
         *
         * @param \WP_User $user     The authenticated user.
         * @param string   $redirect Redirect URL after login.
         */
        Hooks::doAction('bit_connect_after_ajax_login', $user, $redirect);

        return Response::success(
            [
                'redirect' => $redirect,
                'user'     => [
                    'id'           => $user->ID,
                    'username'     => $user->user_login,
                    'slug'         => ProfileSlugService::slugFor($user->ID),
                    'email'        => $user->user_email,
                    'display_name' => $user->display_name,
                    'avatar'       => get_avatar_url($user->ID),
                    'role'         => $roles[0] ?? null,
                    'roles'        => $roles,
                    'hasForumRole' => AuthService::hasForumRole($user->ID),
                ],
                // Fresh nonce so subsequent requests remain valid without page reload
                'nonce' => wp_create_nonce('bit_connect_ajax_login'),
            ]
        );
    }

    /**
     * AJAX logout handler.
     */
    public function logout()
    {
        if (!AuthService::isLoggedIn()) {
            return Response::error('Not authenticated')->httpStatus(401);
        }

        $redirect = AuthService::getLogoutRedirect();

        AuthService::logout();

        /*
         * Fires after a successful AJAX forum logout.
         *
         * @param string $redirect Redirect URL after logout.
         */
        Hooks::doAction('bit_connect_after_ajax_logout', $redirect);

        return Response::success(['redirect' => $redirect]);
    }
}
