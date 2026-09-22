<?php

namespace BitApps\BitConnect\Http\Controller;

// Prevent direct script access
if (!defined('ABSPATH')) {
    exit;
}

use BitApps\BitConnect\Deps\BitApps\WPKit\Hooks\Hooks;
use BitApps\BitConnect\Deps\BitApps\WPKit\Http\Response;
use BitApps\BitConnect\Http\Requests\RestForgotPasswordRequest;
use BitApps\BitConnect\Http\Requests\RestLoginRequest;
use BitApps\BitConnect\Http\Requests\RestSignupRequest;
use BitApps\BitConnect\Http\Requests\RestVerifyEmailRequest;
use BitApps\BitConnect\Services\AuthRateLimiter;
use BitApps\BitConnect\Services\AuthService;
use BitApps\BitConnect\Services\ProfileSlugService;
use WP_Error;
use WP_User;

final class AuthApiController
{
    /**
     * REST login endpoint — delegates entirely to wp_signon().
     *
     * Only serves the plugin's own login form. In custom-URL mode the site has
     * taken ownership of sign-in (its page may add a captcha, 2FA or an approval
     * step), so accepting credentials here would be a way around it.
     */
    public function login(RestLoginRequest $request)
    {
        if (AuthService::isCustomUrlMode()) {
            return Response::error(
                __('The portal login form is disabled. Please use the site login page.', 'bit-connect')
            )->httpStatus(403);
        }

        $username = (string) $request->username;

        // Checked before the credentials are tried, so a caller who is already
        // over the limit costs nothing but the transient read.
        if (!AuthRateLimiter::isAllowed(AuthRateLimiter::LOGIN, $username)) {
            return Response::error(AuthRateLimiter::errorMessage(AuthRateLimiter::LOGIN))
                ->httpStatus(429);
        }

        $user = AuthService::login(
            $username,
            (string) $request->password,
            (bool) ($request->remember ?? false)
        );

        if (is_wp_error($user)) {
            // Only a failure is counted, so somebody signing in correctly is
            // never throttled for it.
            AuthRateLimiter::consume(AuthRateLimiter::LOGIN, $username);

            return Response::error(self::errorMessage($user))
                ->httpStatus(401);
        }

        AuthRateLimiter::forget(AuthRateLimiter::LOGIN, $username);

        Hooks::doAction('bit_connect_after_login', $user);

        return Response::success(self::authResponse($user));
    }

    /**
     * REST signup endpoint.
     *
     * Creates the account WordPress's own registration form would have created
     * — wp_insert_user() with the site's default role, after the `register_post`
     * and `registration_errors` hooks have had their say — and then signs the
     * member in through wp_signon(), like the login endpoint. With email
     * verification on, nothing is created until the link is opened.
     */
    public function signup(RestSignupRequest $request)
    {
        if (AuthService::isCustomUrlMode()) {
            return Response::error(
                __('The portal registration form is disabled. Please use the site registration page.', 'bit-connect')
            )->httpStatus(403);
        }

        if (!AuthService::canRegister()) {
            return Response::error(__('Registration is currently disabled.', 'bit-connect'))
                ->httpStatus(403);
        }

        $email = sanitize_email((string) $request->email);

        // Keyed on the email rather than the username: the username is derived
        // from the email when the form omits it, and the address is what a
        // verification message is sent to.
        if (!AuthRateLimiter::isAllowed(AuthRateLimiter::SIGNUP, $email)) {
            return Response::error(AuthRateLimiter::errorMessage(AuthRateLimiter::SIGNUP))
                ->httpStatus(429);
        }

        AuthRateLimiter::consume(AuthRateLimiter::SIGNUP, $email);

        $rawUsername = $request->username
            ? (string) $request->username
            : preg_replace('/[^a-zA-Z0-9._-]/', '', explode('@', $email)[0]);
        $username = sanitize_user((string) $rawUsername);
        $password = (string) $request->password;
        $displayName = sanitize_text_field((string) ($request->display_name ?? $username));

        // The gate WordPress's own registration form runs — see
        // AuthService::registrationErrors().
        $refused = AuthService::registrationErrors($username, $email);

        if ($refused !== null) {
            return Response::error(self::errorMessage($refused))
                ->httpStatus(422);
        }

        // Hashed here, before the branch, so the copy parked for email
        // verification is never the password itself.
        $passwordHash = wp_hash_password($password);

        // When email verification is required, defer user creation until the email is confirmed
        if (AuthService::requiresEmailVerification()) {
            // Validate uniqueness before storing
            if (username_exists($username)) {
                return Response::error(__('Sorry, that username already exists!', 'bit-connect'))
                    ->httpStatus(422);
            }

            if (email_exists($email)) {
                return Response::error(__('Sorry, that email address is already used!', 'bit-connect'))
                    ->httpStatus(422);
            }

            AuthService::storePendingAndSendVerification(
                compact('username', 'passwordHash', 'email', 'displayName'),
                $email
            );

            return Response::success(
                [
                    'status' => 'verification_pending',
                    'email'  => $email,
                ]
            );
        }

        // wp_insert_user() rejects a duplicate login or email with a WP_Error.
        $userId = AuthService::createMember($username, $email, $displayName, $passwordHash);

        if (is_wp_error($userId)) {
            return Response::error(self::errorMessage($userId))
                ->httpStatus(422);
        }

        Hooks::doAction('bit_connect_after_register', $userId);

        // Through wp_signon(), like the login endpoint, so everything on the
        // `authenticate` chain sees this sign-in as well.
        $user = AuthService::login($username, $password, false);

        if (is_wp_error($user)) {
            // The account exists; something on the authenticate chain declined
            // to open a session for it here. The member can use the login form.
            return Response::success(self::createdResponse($userId));
        }

        return Response::success(self::authResponse($user));
    }

    /**
     * Finish a registration parked for email verification.
     *
     * The token is the key the registration was parked under, single-use and
     * expiring with its transient, and it arrived by email at the address being
     * claimed. Opening the link is the proof this flow asks for, so the account
     * is created and a session opened for it. Only the password's hash was kept,
     * so there is nothing to hand wp_signon(); wp_set_auth_cookie() opens the
     * session for the account that was confirmed a moment ago.
     */
    public function verifyEmail(RestVerifyEmailRequest $request)
    {
        $pending = AuthService::getPendingRegistration((string) $request->token);

        if ($pending === null) {
            return Response::error(__('Invalid verification link.', 'bit-connect'))
                ->httpStatus(422);
        }

        $userId = AuthService::createMember(
            (string) $pending['username'],
            (string) $pending['email'],
            (string) $pending['displayName'],
            (string) $pending['passwordHash']
        );

        if (is_wp_error($userId)) {
            return Response::error(self::errorMessage($userId))
                ->httpStatus(422);
        }

        Hooks::doAction('bit_connect_after_register', $userId);

        AuthService::primeCookieJar();
        wp_set_current_user($userId);
        wp_set_auth_cookie($userId);

        $user = get_userdata($userId);

        return Response::success(
            $user instanceof WP_User ? self::authResponse($user) : self::createdResponse($userId)
        );
    }

    /**
     * Send a password reset email using WordPress's native lost password flow.
     */
    public function forgotPassword(RestForgotPasswordRequest $request)
    {
        $login = sanitize_text_field((string) $request->login);

        if (empty($login)) {
            return Response::error(__('Please enter your username or email address.', 'bit-connect'))
                ->httpStatus(422);
        }

        // Every attempt counts, success or not: this endpoint sends mail, and
        // the harm is a member's inbox being filled rather than a secret being
        // guessed. Consumed before the send so a slow mailer cannot be used to
        // hold the limiter open.
        if (!AuthRateLimiter::isAllowed(AuthRateLimiter::PASSWORD_RESET, $login)) {
            return Response::error(AuthRateLimiter::errorMessage(AuthRateLimiter::PASSWORD_RESET))
                ->httpStatus(429);
        }

        AuthRateLimiter::consume(AuthRateLimiter::PASSWORD_RESET, $login);

        $result = retrieve_password($login);

        if (is_wp_error($result)) {
            return Response::error(self::errorMessage($result))
                ->httpStatus(422);
        }

        return Response::success(['message' => __('Password reset email sent. Please check your inbox.', 'bit-connect')]);
    }

    /**
     * Build the response payload for an endpoint that changes the auth state.
     *
     * WordPress REST nonces are bound to the current user, so the `wp_rest`
     * nonce embedded at page render (for the logged-out visitor) becomes invalid
     * the moment we set the auth cookie. Returning a fresh nonce lets the SPA keep
     * making authenticated requests without a full page reload — otherwise the next
     * request fails the cookie nonce check (rest_cookie_invalid_nonce / 403).
     */
    private static function authResponse(WP_User $user): array
    {
        return array_merge(
            self::formatUser($user),
            [
                'nonce' => wp_create_nonce('wp_rest'),
            ]
        );
    }

    /**
     * WordPress error messages are written for wp-login.php and carry markup —
     * "<strong>Error:</strong> … <a href=…>Lost your password?</a>". The SPA
     * renders them as plain text, so the tags have to go before they ship.
     *
     * @param WP_Error $error
     */
    private static function errorMessage($error): string
    {
        return trim(wp_strip_all_tags((string) $error->get_error_message()));
    }

    /**
     * The payload for an account that was created but not signed in: the user
     * as WordPress now holds it, with no nonce because no session was opened.
     */
    private static function createdResponse(int $userId): array
    {
        $user = get_userdata($userId);

        return $user instanceof WP_User ? self::formatUser($user) : ['id' => $userId];
    }

    private static function formatUser(WP_User $user): array
    {
        $roles = array_values($user->roles);

        return [
            'id'           => $user->ID,
            'username'     => $user->user_login,
            'slug'         => ProfileSlugService::slugFor($user->ID),
            'email'        => $user->user_email,
            'display_name' => $user->display_name,
            'avatar'       => get_avatar_url($user->ID),
            'role'         => $roles[0] ?? null,
            'roles'        => $roles,
        ];
    }
}
