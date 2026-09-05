<?php

namespace BitApps\BitConnect\Services;

// Prevent direct script access
if (!defined('ABSPATH')) {
    exit;
}

use BitApps\BitConnect\Config;
use WP_Error;
use WP_User;

/**
 * Changing the email address on an account, confirmed from the new inbox.
 *
 * The address is not written when the member asks for it — it is parked until
 * they click a link sent to the address they typed. A typo would otherwise lock
 * them out of their own password reset, and an unconfirmed address is how an
 * account quietly ends up pointing somewhere its owner cannot read.
 *
 * This mirrors what WordPress core does on the profile screen (the `_new_email`
 * flow), including not asking for the password: the confirmation link going to
 * the new inbox is what proves the request.
 *
 * Deliberately NOT reusing `bit_connect_email_verify_token`, the meta pair
 * AuthService::verifyEmail() reads. Nothing writes that pair today, so it looks
 * like a free socket — but AuthApiController still routes `auth/verify-email`
 * through it, and sharing the key would let a registration confirmation consume
 * an email-change token.
 */
class EmailChangeService
{
    /**
     * How long a confirmation link stays valid.
     *
     * A literal rather than DAY_IN_SECONDS so the class carries no WordPress
     * constant dependency into unit tests.
     */
    private const TOKEN_TTL = 86400;

    private const META_PENDING = Config::VAR_PREFIX . 'pending_email';

    private const META_TOKEN = Config::VAR_PREFIX . 'email_change_token';

    private const META_EXPIRY = Config::VAR_PREFIX . 'email_change_expiry';

    /**
     * The address this member is waiting to confirm, or '' when none.
     *
     * @param int $userId
     *
     * @return string
     */
    public static function pendingEmail($userId)
    {
        return (string) get_user_meta((int) $userId, self::META_PENDING, true);
    }

    /**
     * Park a new address and email a confirmation link to it.
     *
     * @param int    $userId
     * @param string $email
     *
     * @return true|WP_Error
     */
    public static function requestChange($userId, $email)
    {
        $userId = (int) $userId;
        $user = get_userdata($userId);

        if (!$user instanceof WP_User) {
            return new WP_Error('user_not_found', __('User not found.', 'bit-connect'));
        }

        $email = sanitize_email((string) $email);

        if (!is_email($email)) {
            return new WP_Error('invalid_email', __('Please enter a valid email address.', 'bit-connect'));
        }

        if (strtolower($email) === strtolower((string) $user->user_email)) {
            return new WP_Error('email_unchanged', __('That is already your email address.', 'bit-connect'));
        }

        $existing = email_exists($email);

        if ($existing && (int) $existing !== $userId) {
            return new WP_Error('email_taken', __('That email address is already in use.', 'bit-connect'));
        }

        $token = wp_generate_password(48, false);

        // Overwrites any earlier pending change, which is how a member corrects
        // a typo: ask again, and the previous link stops working.
        update_user_meta($userId, self::META_PENDING, $email);
        update_user_meta($userId, self::META_TOKEN, $token);
        update_user_meta($userId, self::META_EXPIRY, time() + self::TOKEN_TTL);

        self::sendConfirmation($userId, $email, $token);

        return true;
    }

    /**
     * Apply a parked address once the member proves they can read it.
     *
     * @param int    $userId
     * @param string $token
     *
     * @return WP_Error|WP_User
     */
    public static function confirm($userId, $token)
    {
        $userId = (int) $userId;
        $storedToken = (string) get_user_meta($userId, self::META_TOKEN, true);
        $expiry = (int) get_user_meta($userId, self::META_EXPIRY, true);
        $pending = self::pendingEmail($userId);

        if ($storedToken === '' || $pending === '' || !hash_equals($storedToken, (string) $token)) {
            return new WP_Error('invalid_token', __('This confirmation link is not valid.', 'bit-connect'));
        }

        if (time() > $expiry) {
            self::clear($userId);

            return new WP_Error(
                'token_expired',
                __('This confirmation link has expired. Please request the change again.', 'bit-connect')
            );
        }

        // Re-checked rather than trusted from requestChange(): the link may have
        // sat in an inbox for a day, and someone else could have registered the
        // address in the meantime.
        $existing = email_exists($pending);

        if ($existing && (int) $existing !== $userId) {
            self::clear($userId);

            return new WP_Error('email_taken', __('That email address is already in use.', 'bit-connect'));
        }

        // Cleared before the update so a link can never be spent twice, even if
        // wp_update_user() fails below.
        self::clear($userId);

        $result = wp_update_user(['ID' => $userId, 'user_email' => $pending]);

        if (is_wp_error($result)) {
            return $result;
        }

        $user = get_userdata($userId);

        return $user instanceof WP_User
            ? $user
            : new WP_Error('user_not_found', __('User not found.', 'bit-connect'));
    }

    /**
     * Drop a pending change and its token.
     *
     * @param int $userId
     */
    public static function clear($userId): void
    {
        $userId = (int) $userId;

        delete_user_meta($userId, self::META_PENDING);
        delete_user_meta($userId, self::META_TOKEN);
        delete_user_meta($userId, self::META_EXPIRY);
    }

    /**
     * Mail the confirmation link to the address being claimed.
     *
     * Sent to the new address, not the current one — reading it is the whole
     * proof this flow asks for.
     */
    private static function sendConfirmation(int $userId, string $email, string $token): void
    {
        $confirmUrl = AuthService::getForumPageUrl()
            . '?bc_email_token=' . rawurlencode($token)
            . '&bc_uid=' . $userId;

        $subject = __('Confirm your new email address', 'bit-connect');
        $message = \sprintf(
            // translators: %s: confirmation URL
            __("Hello,\n\nPlease confirm this address so we can use it for your account:\n\n%s\n\nThis link expires in 24 hours.\n\nIf you did not ask to change your email address, you can safely ignore this email — nothing has changed.", 'bit-connect'), // phpcs:ignore Generic.Files.LineLength.MaxExceeded
            $confirmUrl
        );

        wp_mail($email, $subject, $message);
    }
}
