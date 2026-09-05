<?php

namespace BitApps\BitConnect\Services;

// Prevent direct script access
if (!\defined('ABSPATH')) {
    exit;
}

use BitApps\BitConnect\Config;
use BitApps\BitConnect\Deps\BitApps\WPKit\Hooks\Hooks;
use BitApps\BitConnect\Enum\AuthSettings;
use BitApps\BitConnect\Enum\Capabilities;
use WP_Error;
use WP_Role;
use WP_User;

/**
 * Authentication service — authentication-agnostic strategy layer.
 *
 * All forum auth decisions flow through this class. It never implements
 * a custom password/session system; it delegates entirely to WordPress core.
 *
 * Role/capability management has moved to CapabilityService.
 * Permission checks have moved to PermissionService.
 * Both are still accessible here via backward-compat constants and shims
 * so existing callers do not need to change.
 */
final class AuthService
{
    // -------------------------------------------------------------------------
    // Backward-compat capability constants (point at new Capabilities enum)
    // -------------------------------------------------------------------------

    /**
     * Deprecated capability constant.
     *
     * @deprecated Use Capabilities::MANAGE->value
     */
    public const CAP_MANAGE = Capabilities::MANAGE->value;

    /**
     * Deprecated capability constant.
     *
     * @deprecated Use Capabilities::MODERATE->value
     */
    public const CAP_MODERATE = Capabilities::MODERATE->value;

    /**
     * Deprecated capability constant.
     *
     * @deprecated Use Capabilities::CREATE_POST->value
     */
    public const CAP_POST = Capabilities::CREATE_POST->value;

    /**
     * Deprecated capability constant.
     *
     * @deprecated Use Capabilities::CREATE_COMMENT->value
     */
    public const CAP_COMMENT = Capabilities::CREATE_COMMENT->value;

    /**
     * Deprecated capability constant.
     *
     * @deprecated Use Capabilities::VOTE_POST->value
     */
    public const CAP_VOTE = Capabilities::VOTE_POST->value;

    // Legacy role slugs kept as constants so external code referencing them
    // still compiles, but the roles themselves are no longer created.
    public const CUSTOM_ROLE = 'bit_connect_member';

    public const MODERATOR_ROLE = 'bit_connect_moderator';

    private const PENDING_TRANSIENT_PREFIX = 'bc_pending_reg_';

    // -------------------------------------------------------------------------
    // Settings helpers
    // -------------------------------------------------------------------------

    public static function getSettings(): array
    {
        $defaults = self::defaultSettings();
        $saved = Config::getOption(AuthSettings::OPTION_NAME->value, $defaults);

        if (!\is_array($saved)) {
            return $defaults;
        }

        return array_replace_recursive($defaults, $saved);
    }

    public static function getMode(): string
    {
        return self::getSettings()['mode'] ?? AuthSettings::MODE_PLUGIN_DEFAULT->value;
    }

    public static function isCustomUrlMode(): bool
    {
        return self::getMode() === AuthSettings::MODE_CUSTOM_URL->value;
    }

    /**
     * The custom login page as handed to the portal, or '' when it is unusable.
     *
     * Blank means "no custom page": the portal then falls back to the WordPress
     * login URL, which is itself filtered and so already points at whatever
     * login page the site really uses.
     */
    public static function customLoginUrl(): string
    {
        return self::usableExternalUrl('customLoginUrl');
    }

    /**
     * The custom registration page as handed to the portal, or '' — see
     * customLoginUrl().
     */
    public static function customRegistrationUrl(): string
    {
        return self::usableExternalUrl('customRegistrationUrl');
    }

    // -------------------------------------------------------------------------
    // WordPress-native identity checks
    // -------------------------------------------------------------------------

    public static function isLoggedIn(): bool
    {
        return is_user_logged_in();
    }

    public static function getCurrentUser(): ?WP_User
    {
        return is_user_logged_in() ? wp_get_current_user() : null;
    }

    public static function getCurrentUserId(): int
    {
        return get_current_user_id();
    }

    // -------------------------------------------------------------------------
    // URL helpers — respects third-party auth plugins automatically
    // -------------------------------------------------------------------------

    public static function getLoginUrl(string $redirect = ''): string
    {
        return wp_login_url($redirect ?: self::getLoginRedirect());
    }

    public static function getLogoutUrl(string $redirect = ''): string
    {
        return wp_logout_url($redirect ?: self::getLogoutRedirect());
    }

    public static function getLoginRedirect(): string
    {
        $settings = self::getSettings();

        return !empty($settings['redirectAfterLogin'])
            ? esc_url_raw($settings['redirectAfterLogin'])
            : home_url('/');
    }

    public static function getLogoutRedirect(): string
    {
        $settings = self::getSettings();

        return !empty($settings['redirectAfterLogout'])
            ? esc_url_raw($settings['redirectAfterLogout'])
            : home_url('/');
    }

    // -------------------------------------------------------------------------
    // Permission checks (delegates to PermissionService / WP caps)
    // -------------------------------------------------------------------------

    public static function canRegister(): bool
    {
        // Multisite ignores users_can_register; the network-wide 'registration'
        // option decides, and 'user'/'all' both allow new accounts.
        if (is_multisite()) {
            return \in_array(get_site_option('registration', 'none'), ['user', 'all'], true);
        }

        return (bool) get_option('users_can_register', 0);
    }

    /**
     * Returns true when the user holds any forum participation capability.
     *
     * Backward-compatible shim for callers checking forum membership.
     * New code should use PermissionService::isForumParticipant() directly.
     */
    public static function hasForumRole(int $userId = 0): bool
    {
        $userId = $userId ?: get_current_user_id();

        if (!$userId) {
            return false;
        }

        $user = get_userdata($userId);

        if (!$user instanceof WP_User) {
            return false;
        }

        // WordPress administrators always have forum access.
        if ($user->has_cap('manage_options')) {
            return true;
        }

        // Check any of the granular forum caps; any match = forum participant.
        foreach (Capabilities::memberCaps() as $cap) {
            if ($user->has_cap($cap->value)) {
                return true;
            }
        }

        return false;
    }

    /**
     * Returns true when the user can access the forum admin panel.
     *
     * Backward-compatible shim. New code: current_user_can(Capabilities::MANAGE->value).
     */
    public static function hasModeratorRole(int $userId = 0): bool
    {
        $userId = $userId ?: get_current_user_id();

        if (!$userId) {
            return false;
        }

        $user = get_userdata($userId);

        if (!$user instanceof WP_User) {
            return false;
        }

        return $user->has_cap('manage_options')
            || $user->has_cap(Capabilities::MANAGE->value);
    }

    public static function canPerform(string $action, int $userId = 0): bool
    {
        $userId = $userId ?: get_current_user_id();
        $allowed = self::hasForumRole($userId);

        /*
         * Filter whether a user can perform a specific forum action.
         *
         * @param bool   $allowed Whether the action is allowed.
         * @param string $action  The action being checked.
         * @param int    $userId  The user ID being checked.
         */
        return (bool) Hooks::applyFilter('bit_connect_can_perform', $allowed, $action, $userId);
    }

    // -------------------------------------------------------------------------
    // Login / logout (modal mode only — delegates to WP core)
    // -------------------------------------------------------------------------

    /**
     * Attempt login via wp_signon(). Returns WP_User on success or WP_Error.
     *
     * @return WP_Error|WP_User
     */
    public static function login(string $username, string $password, bool $rememberMe = false)
    {
        // Capture the auth cookies into $_COOKIE so a wp_rest nonce generated
        // later in THIS request is bound to the correct session token.
        self::primeCookieJar();

        $credentials = [
            'user_login'    => sanitize_user($username),
            'user_password' => $password,
            'remember'      => $rememberMe,
        ];

        // These are interactive form credentials, never an application password.
        // WordPress only runs that authenticator inside a REST request — which
        // is exactly where this endpoint lives — so leaving it in place makes a
        // simple typo report "The provided password is an invalid application
        // password" on every site where application passwords have been used.
        $appPasswordsEnabled = remove_filter('authenticate', 'wp_authenticate_application_password', 20);

        $user = wp_signon($credentials, is_ssl());

        if ($appPasswordsEnabled) {
            Hooks::addFilter('authenticate', 'wp_authenticate_application_password', 20, 3);
        }

        if (!is_wp_error($user)) {
            wp_set_current_user($user->ID);
        }

        return $user;
    }

    /**
     * Populate $_COOKIE with the auth cookies that wp_set_auth_cookie() emits
     * during the current request.
     *
     * WordPress binds nonces to the logged-in session token, which it reads from
     * $_COOKIE. During a login/verification request the cookie is only being sent
     * in the response — it is not in $_COOKIE yet — so wp_get_session_token()
     * returns an empty token and any nonce we generate is invalid once the real
     * cookie round-trips on the next request (rest_cookie_invalid_nonce / 403).
     *
     * Hooking the cookie-setting actions lets us seed $_COOKIE in time, so the
     * fresh nonce returned to the SPA is actually usable.
     */
    public static function primeCookieJar(): void
    {
        static $primed = false;

        if ($primed) {
            return;
        }

        $primed = true;

        Hooks::addAction(
            'set_logged_in_cookie',
            static function ($loggedInCookie) {
                $_COOKIE[LOGGED_IN_COOKIE] = $loggedInCookie;
            }
        );

        Hooks::addAction(
            'set_auth_cookie',
            static function ($authCookie, $expire, $expiration, $userId, $scheme) {
                $name = $scheme === 'secure_auth' ? SECURE_AUTH_COOKIE : AUTH_COOKIE;
                $_COOKIE[$name] = $authCookie;
            },
            10,
            5
        );
    }

    public static function logout(): void
    {
        wp_logout();
        wp_clear_auth_cookie();
    }

    /**
     * Whether this account has a password that could ever be entered.
     *
     * Accounts created by an SSO or social-login plugin often have no password
     * at all. An empty user_pass is not a password of "" — wp_check_password()
     * returns false for every input against an empty hash, including the empty
     * string — so such a member can never satisfy a "current password" prompt.
     * Asking them for one would lock them out of ever setting one.
     *
     * Note what this cannot tell you: an SSO plugin that generated a random
     * password leaves a perfectly valid hash behind, and that is
     * indistinguishable from a password the member chose. Those accounts report
     * true here and have to go through a reset link instead.
     *
     * @param int $userId
     */
    public static function hasUsablePassword($userId): bool
    {
        $user = get_userdata((int) $userId);

        return $user instanceof WP_User && trim((string) $user->user_pass) !== '';
    }

    // -------------------------------------------------------------------------
    // Role management (now delegates to CapabilityService)
    // -------------------------------------------------------------------------

    /**
     * Registers forum capabilities and applies default settings.
     *
     * This no longer creates custom WP roles. Instead it:
     * 1. Runs the legacy cap migration (one-time, idempotent)
     * 2. Initialises default capability settings (one-time, idempotent)
     * 3. Grants forum_manage to the administrator role as a safe default
     *
     * Called from InstallerProvider::registerActivator().
     */
    public static function registerCustomRole(): void
    {
        // Remove legacy custom roles from the WP roles list (one-time cleanup).
        // Users who held these roles keep their account; WordPress falls back to
        // no-role, and their forum access is now governed by capabilities alone.
        self::removeLegacyRoles();

        // One-time migration of legacy bit_connect_* capabilities
        CapabilityService::migrateFromLegacyCaps();

        // Initialise defaults on first run, then always re-apply saved settings.
        // Re-applying is required because deactivation strips all forum caps from
        // WP roles — without this, reactivation would leave every role cap-less.
        CapabilityService::initDefaultSettings();
        CapabilityService::applySettings(CapabilityService::getSettings());
    }

    /**
     * Removes all forum_* capabilities from every role.
     * Called on plugin deactivation.
     */
    public static function removeCustomRole(): void
    {
        self::removeLegacyRoles();
        CapabilityService::removeAllCapabilities();
    }

    // -------------------------------------------------------------------------
    // Default settings
    // -------------------------------------------------------------------------

    public static function defaultSettings(): array
    {
        return [
            'mode'                     => AuthSettings::MODE_PLUGIN_DEFAULT->value,
            'loginPageCustomization'   => ['banner' => '', 'title' => '', 'description' => ''],
            'customLoginUrl'           => '',
            'customRegistrationUrl'    => '',
            'redirectAfterLogin'       => '',
            'redirectAfterLogout'      => '',
            'requireEmailVerification' => false,
            'registrationRole'         => self::defaultRegistrationRole(),
        ];
    }

    /**
     * WP roles a self-registered user may be assigned. Roles that can manage the
     * site (manage_options) are excluded so registration can never hand out an
     * admin-capable role.
     *
     * @return array<int, array{value: string, label: string}>
     */
    public static function assignableRoles(): array
    {
        $roles = [];

        foreach (wp_roles()->get_names() as $slug => $name) {
            $role = get_role($slug);

            if (!$role instanceof WP_Role) {
                continue;
            }

            if (!empty($role->capabilities['manage_options'])) {
                continue;
            }

            $roles[] = [
                'value' => $slug,
                'label' => translate_user_role((string) $name),
            ];
        }

        return $roles;
    }

    /**
     * The role assigned to users who register through the Bit Connect form.
     * Falls back to a safe default if the stored role is missing or not
     * assignable (e.g. it was deleted or is an admin role).
     */
    public static function getRegistrationRole(): string
    {
        $configured = (string) (self::getSettings()['registrationRole'] ?? '');

        return self::sanitizeRegistrationRole($configured);
    }

    /**
     * Validate a candidate registration role against the assignable list,
     * falling back to the default when it is empty/unknown/not assignable.
     */
    public static function sanitizeRegistrationRole(string $role): string
    {
        $role = sanitize_key($role);
        $allowed = array_column(self::assignableRoles(), 'value');

        return \in_array($role, $allowed, true) ? $role : self::defaultRegistrationRole();
    }

    /**
     * Safe default registration role. Prefers 'subscriber'; falls back to
     * WordPress' own default_role, then the first assignable role.
     */
    public static function defaultRegistrationRole(): string
    {
        $allowed = array_column(self::assignableRoles(), 'value');

        if (\in_array('subscriber', $allowed, true)) {
            return 'subscriber';
        }

        $wpDefault = sanitize_key((string) get_option('default_role', 'subscriber'));
        if (\in_array($wpDefault, $allowed, true)) {
            return $wpDefault;
        }

        return $allowed[0] ?? 'subscriber';
    }

    public static function requiresEmailVerification(): bool
    {
        return (bool) (self::getSettings()['requireEmailVerification'] ?? false);
    }

    /**
     * Returns the URL of the portal page (where the client SPA is embedded).
     */
    public static function getForumPageUrl(): string
    {
        $portalSlug = Config::getOption('portal_page');

        if ($portalSlug) {
            $pages = get_posts(
                [
                    'post_type'      => 'page',
                    'name'           => $portalSlug,
                    'posts_per_page' => 1,
                    'post_status'    => 'publish',
                ]
            );

            if (!empty($pages)) {
                return rtrim((string) get_permalink($pages[0]->ID), '/');
            }
        }

        return rtrim(home_url(), '/');
    }

    /**
     * Stores pending registration data and sends a verification email.
     * The WP user is NOT created yet — creation happens in verifyEmail().
     */
    public static function storePendingAndSendVerification(array $data, string $email): void
    {
        $token = wp_generate_password(48, false);

        set_transient(self::PENDING_TRANSIENT_PREFIX . $token, $data, DAY_IN_SECONDS);

        $verifyUrl = self::getForumPageUrl() . '?bc_token=' . rawurlencode($token);

        $subject = __('Verify your email address', 'bit-connect');
        $message = \sprintf(
            // translators: %s: verification URL
            __("Hello,\n\nThank you for registering. Please verify your email address by clicking the link below:\n\n%s\n\nThis link expires in 24 hours.\n\nIf you did not register, you can safely ignore this email.", 'bit-connect'), // phpcs:ignore Generic.Files.LineLength.MaxExceeded
            $verifyUrl
        );

        wp_mail($email, $subject, $message);
    }

    /**
     * Atomically claims and returns the pending registration data for a token.
     */
    public static function getPendingRegistration(string $token): ?array
    {
        $key = self::PENDING_TRANSIENT_PREFIX . $token;
        $data = get_transient($key);

        if (!\is_array($data)) {
            return null;
        }

        if (!delete_transient($key)) {
            return null;
        }

        return $data;
    }

    /**
     * Validates the token for an already-created user and marks email as verified.
     *
     * @return WP_Error|WP_User
     */
    public static function verifyEmail(int $userId, string $token)
    {
        $storedToken = get_user_meta($userId, 'bit_connect_email_verify_token', true);
        $expiry = (int) get_user_meta($userId, 'bit_connect_email_verify_expiry', true);

        if (!$storedToken || !hash_equals($storedToken, $token)) {
            return new WP_Error('invalid_token', __('Invalid verification link.', 'bit-connect'));
        }

        if (time() > $expiry) {
            return new WP_Error('token_expired', __('This verification link has expired. Please register again.', 'bit-connect'));
        }

        delete_user_meta($userId, 'bit_connect_email_verify_token');
        delete_user_meta($userId, 'bit_connect_email_verify_expiry');

        $user = get_userdata($userId);

        if (!$user instanceof WP_User) {
            return new WP_Error('user_not_found', __('User not found.', 'bit-connect'));
        }

        return $user;
    }

    private static function removeLegacyRoles(): void
    {
        remove_role(self::CUSTOM_ROLE);
        remove_role(self::MODERATOR_ROLE);
    }

    /**
     * A configured external auth URL, minus the ones that point back at the
     * portal's own screens.
     *
     * The stored value is left untouched — the settings screen has to keep
     * showing administrators what they typed. Only the copy sent to the portal
     * is filtered, and only where sending it would create a redirect loop.
     */
    private static function usableExternalUrl(string $key): string
    {
        $url = trim((string) (self::getSettings()[$key] ?? ''));

        if ($url === '') {
            return '';
        }

        return PortalLocation::ownsAuthRoute($url) ? '' : $url;
    }
}
