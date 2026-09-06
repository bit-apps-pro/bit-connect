<?php

namespace BitApps\BitConnect\Http\Controller;

// Prevent direct script access
if (!defined('ABSPATH')) {
    exit;
}

use BitApps\BitConnect\Deps\BitApps\WPKit\Http\Response;
use BitApps\BitConnect\Http\Requests\ChangePasswordRequest;
use BitApps\BitConnect\Http\Requests\RequestEmailChangeRequest;
use BitApps\BitConnect\Http\Requests\RestVerifyEmailChangeRequest;
use BitApps\BitConnect\Http\Requests\SendPasswordResetRequest;
use BitApps\BitConnect\Services\AuthRateLimiter;
use BitApps\BitConnect\Services\AuthService;
use BitApps\BitConnect\Services\EmailChangeService;
use BitApps\BitConnect\Services\ProfileSlugService;
use WP_Error;
use WP_User;

/**
 * The two account settings that are not part of a public profile.
 *
 * POST /users/{id}/password           — change password (owner only)
 * POST /users/{id}/email              — start an email change (owner only)
 * POST /auth/verify-email-change      — finish one (token authorises)
 *
 * Members could already do both through wp-login.php and wp-admin; keeping them
 * in the portal is what stops "change your password" meaning "leave the site".
 */
final class AccountSecurityController
{
    private const HTTP_BAD_REQUEST = 400;

    private const HTTP_NOT_FOUND = 404;

    public function changePassword(ChangePasswordRequest $request)
    {
        $userId = (int) $request->id;
        $user = get_userdata($userId);

        if (!$user instanceof WP_User) {
            return Response::error(__('User not found.', 'bit-connect'))->httpStatus(self::HTTP_NOT_FOUND);
        }

        // Proves the person at the keyboard is the account owner and not someone
        // who walked up to an unlocked session.
        //
        // Skipped for an account that has no password at all — typically one an
        // SSO plugin created. There is nothing to prove against, and demanding
        // it would mean such a member could never set a first password. The
        // session cookie is the only evidence available, which is also all
        // WordPress's own profile screen asks for.
        if (AuthService::hasUsablePassword($userId)) {
            $current = (string) ($request->current_password ?? '');

            // Separated from a wrong password so the member is told which
            // mistake they made: the rules cannot require this field, because
            // whether it applies depends on the stored hash.
            if ($current === '') {
                return Response::error(
                    ['current_password' => [__('Please enter your current password.', 'bit-connect')]],
                    self::HTTP_BAD_REQUEST
                )->code('VALIDATION');
            }

            if (!wp_check_password($current, $user->user_pass, $userId)) {
                return Response::error(
                    ['current_password' => [__('That is not your current password.', 'bit-connect')]],
                    self::HTTP_BAD_REQUEST
                )->code('VALIDATION');
            }
        }

        // Seeded before wp_set_password so the nonce minted below is bound to
        // the session token the new cookie will carry.
        AuthService::primeCookieJar();

        // Destroys every session for this user, including the one making this
        // request — hence the re-auth immediately after. Without it the SPA's
        // very next call fails the cookie nonce check with a 403.
        wp_set_password((string) $request->new_password, $userId);

        wp_set_current_user($userId);
        wp_set_auth_cookie($userId);

        return Response::success(
            [
                'message' => __('Your password has been changed.', 'bit-connect'),
                'nonce'   => wp_create_nonce('wp_rest'),
            ]
        );
    }

    /**
     * Email the member a reset link for their own account.
     *
     * The way out of the case hasUsablePassword() cannot detect: an SSO plugin
     * generated a real password the member has never seen, so "current
     * password" is unanswerable but the stored hash looks perfectly ordinary.
     * A reset link needs no prior knowledge.
     *
     * Takes no address — it always goes to the signed-in account's own email, so
     * this cannot be used to probe whether some other address is registered.
     */
    public function sendPasswordReset(SendPasswordResetRequest $request)
    {
        $user = get_userdata((int) $request->id);

        if (!$user instanceof WP_User) {
            return Response::error(__('User not found.', 'bit-connect'))->httpStatus(self::HTTP_NOT_FOUND);
        }

        // Owner-only, so this is not the brute-force surface auth/forgot-password
        // is — but it still ends in a message to a real inbox, and the same
        // bucket keeps a signed-in member from using it to flood their own.
        if (!AuthRateLimiter::isAllowed(AuthRateLimiter::PASSWORD_RESET, $user->user_login)) {
            return Response::error(AuthRateLimiter::errorMessage(AuthRateLimiter::PASSWORD_RESET))
                ->httpStatus(429);
        }

        AuthRateLimiter::consume(AuthRateLimiter::PASSWORD_RESET, $user->user_login);

        $result = retrieve_password($user->user_login);

        if (is_wp_error($result)) {
            return Response::error(self::errorMessage($result))->httpStatus(self::HTTP_BAD_REQUEST);
        }

        return Response::success(
            ['message' => __('Check your inbox for a link to set a new password.', 'bit-connect')]
        );
    }

    public function requestEmailChange(RequestEmailChangeRequest $request)
    {
        $userId = (int) $request->id;
        $result = EmailChangeService::requestChange($userId, (string) $request->email);

        if (is_wp_error($result)) {
            return Response::error(
                ['email' => [self::errorMessage($result)]],
                self::HTTP_BAD_REQUEST
            )->code('VALIDATION');
        }

        return Response::success(
            [
                'pending_email' => EmailChangeService::pendingEmail($userId),
                'message'       => __('Check your new inbox for a confirmation link.', 'bit-connect'),
            ]
        );
    }

    public function confirmEmailChange(RestVerifyEmailChangeRequest $request)
    {
        $user = EmailChangeService::confirm((int) $request->user_id, (string) $request->token);

        if (is_wp_error($user)) {
            return Response::error(self::errorMessage($user))->httpStatus(self::HTTP_BAD_REQUEST);
        }

        $roles = array_values($user->roles);

        return Response::success(
            [
                'id'           => $user->ID,
                'username'     => $user->user_login,
                'slug'         => ProfileSlugService::slugFor($user->ID),
                'email'        => $user->user_email,
                'display_name' => $user->display_name,
                'avatar'       => get_avatar_url($user->ID),
                'role'         => $roles[0] ?? null,
                'roles'        => $roles,
            ]
        );
    }

    /**
     * WordPress error messages are written for wp-login.php and carry markup.
     * The SPA renders them as plain text, so the tags have to go before they
     * ship.
     *
     * @param WP_Error $error
     */
    private static function errorMessage($error): string
    {
        return trim(wp_strip_all_tags((string) $error->get_error_message()));
    }
}
