<?php

namespace BitApps\BitConnect\Http\Controller;

// Prevent direct script access
if (!\defined('ABSPATH')) {
    exit;
}

use BitApps\BitConnect\Deps\BitApps\WPKit\Http\Response;
use BitApps\BitConnect\Http\Requests\GetCurrentUserRequest;
use BitApps\BitConnect\Http\Requests\LogoutRequest;
use BitApps\BitConnect\Services\AuthService;
use BitApps\BitConnect\Services\EmailChangeService;
use BitApps\BitConnect\Services\PermissionService;
use BitApps\BitConnect\Services\ProfileSlugService;

final class AuthController
{
    public function me(GetCurrentUserRequest $_request) // phpcs:ignore VariableAnalysis.CodeAnalysis.VariableAnalysis.UnusedVariable
    {
        // Guests are a valid state: return 200 with null instead of an error,
        // so the portal can resolve logged-out without a 400/401 round-trip.
        if (!is_user_logged_in()) {
            return Response::success(null);
        }

        $user = wp_get_current_user();
        $roles = \is_array($user->roles ?? null) ? array_values($user->roles) : [];

        $userData = [
            'id'           => $user->ID,
            'username'     => $user->user_login,
            'slug'         => ProfileSlugService::slugFor($user->ID),
            'email'        => $user->user_email,
            'display_name' => $user->display_name,
            'avatar'       => get_avatar_url($user->ID),
            'role'         => $roles[0] ?? null,
            'roles'        => $roles,
            // An address the member asked for but has not confirmed yet, so the
            // settings form can say so rather than looking as though the change
            // was ignored.
            'pending_email' => EmailChangeService::pendingEmail($user->ID),
            // False for accounts an SSO plugin created without one. The settings
            // form uses it to ask them to *set* a password rather than to quote
            // back one they have never had.
            'has_password' => AuthService::hasUsablePassword($user->ID),
            // Mirrors the bootstrap payload in Config::getCurrentUserInfo(), so
            // a portal that seeds itself from either source gates its controls
            // on the same answers this API enforces.
            'capabilities' => PermissionService::currentUserCapabilities(),
        ];

        return Response::success($userData);
    }

    public function logout(LogoutRequest $_request) // phpcs:ignore VariableAnalysis.CodeAnalysis.VariableAnalysis.UnusedVariable
    {
        wp_logout();
        wp_clear_auth_cookie();

        return Response::success(['message' => 'Logged out successfully']);
    }
}
