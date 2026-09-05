<?php

namespace BitApps\BitConnect\Http\Requests;

if (!defined('ABSPATH')) {
    exit;
}

use BitApps\BitConnect\Deps\BitApps\WPKit\Http\Request\Request;
use BitApps\BitConnect\Deps\BitApps\WPKit\Utils\Capabilities;
use BitApps\BitConnect\Enum\AuthSettings;
use BitApps\BitConnect\Services\AuthService;

/**
 * Request input properties.
 *
 * @property string $mode
 * @property string $customLoginUrl
 * @property string $customRegistrationUrl
 * @property array  $loginPageCustomization
 * @property string $redirectAfterLogin
 * @property string $redirectAfterLogout
 * @property bool   $requireEmailVerification
 * @property string $registrationRole
 */
final class UpdateAuthSettingsRequest extends Request
{
    public function authorize()
    {
        return Capabilities::check(AuthService::CAP_MANAGE);
    }

    public function failedAuthorizationMessage(): string
    {
        if (!is_user_logged_in()) {
            return 'You must be logged in to update authentication settings.';
        }

        return 'You do not have permission to update authentication settings.';
    }

    public function rules()
    {
        return [
            'mode' => ['required', 'string'],
        ];
    }

    public function messages()
    {
        return [
            'mode.required' => 'Authentication mode is required.',
            'mode.string'   => 'Authentication mode must be a string.',
        ];
    }

    /**
     * Field-keyed errors for the custom-URL mode, empty when the payload is fine.
     *
     * Custom-URL mode hands sign-in to another page, so a missing or unusable
     * login URL leaves visitors with nowhere to go. The portal falls back to the
     * WordPress login URL at runtime, but the administrator should be told
     * rather than silently given a different login page than they configured.
     *
     * @return array<string, string[]>
     */
    public function customUrlErrors(): array
    {
        if ($this->resolveMode() !== AuthSettings::MODE_CUSTOM_URL->value) {
            return [];
        }

        $errors = [];

        $loginRaw = trim((string) ($this->customLoginUrl ?? ''));

        if ($loginRaw === '') {
            $errors['customLoginUrl'] = [
                __('A custom login page URL is required when using a custom login page.', 'bit-connect'),
            ];
        } elseif (self::normalizeUrl($loginRaw) === '') {
            $errors['customLoginUrl'] = [
                __('The custom login page URL is not a valid URL, for example https://example.com/login.', 'bit-connect'),
            ];
        }

        $registrationRaw = trim((string) ($this->customRegistrationUrl ?? ''));

        if ($registrationRaw !== '' && self::normalizeUrl($registrationRaw) === '') {
            $errors['customRegistrationUrl'] = [
                __('The custom registration page URL is not a valid URL, for example https://example.com/register.', 'bit-connect'),
            ];
        }

        return $errors;
    }

    public function toSettingsData(): array
    {
        $customization = \is_array($this->loginPageCustomization) ? $this->loginPageCustomization : [];

        $defaults = AuthService::defaultSettings();

        return [
            'mode'                   => $this->resolveMode(),
            'loginPageCustomization' => [
                'banner'      => sanitize_text_field((string) ($customization['banner'] ?? '')),
                'title'       => sanitize_text_field((string) ($customization['title'] ?? '')),
                'description' => sanitize_textarea_field((string) ($customization['description'] ?? '')),
            ],
            'customLoginUrl'           => self::normalizeUrl((string) ($this->customLoginUrl ?? '')),
            'customRegistrationUrl'    => self::normalizeUrl((string) ($this->customRegistrationUrl ?? '')),
            'redirectAfterLogin'       => esc_url_raw((string) ($this->redirectAfterLogin ?? '')),
            'redirectAfterLogout'      => esc_url_raw((string) ($this->redirectAfterLogout ?? '')),
            'requireEmailVerification' => (bool) ($this->requireEmailVerification ?? $defaults['requireEmailVerification']),
            'registrationRole'         => AuthService::sanitizeRegistrationRole((string) ($this->registrationRole ?? '')),
        ];
    }

    /**
     * Unknown modes fall back to the plugin's own form rather than being stored,
     * so a bad payload can never leave the portal without a login page.
     */
    private function resolveMode(): string
    {
        $validModes = [
            AuthSettings::MODE_PLUGIN_DEFAULT->value,
            AuthSettings::MODE_CUSTOM_URL->value,
        ];

        return \in_array($this->mode, $validModes, true)
            ? $this->mode
            : AuthSettings::MODE_PLUGIN_DEFAULT->value;
    }

    /**
     * Absolute http(s) URL, or an empty string when the value cannot become one.
     *
     * A scheme-less "example.com/login" is promoted to a full URL by
     * esc_url_raw(), which also happily keeps site-relative paths such as
     * "/login" — the portal cannot use those as an external login page, so they
     * are rejected here instead of being stored.
     */
    private static function normalizeUrl(string $value): string
    {
        $value = trim($value);

        if ($value === '' || preg_match('/\s/', $value)) {
            return '';
        }

        $url = esc_url_raw($value, ['http', 'https']);

        if ($url === '') {
            return '';
        }

        $host = wp_parse_url($url, PHP_URL_HOST);
        $scheme = wp_parse_url($url, PHP_URL_SCHEME);

        if (!\in_array($scheme, ['http', 'https'], true)) {
            return '';
        }

        // esc_url_raw() will happily turn free text into "http://not%20a%20url",
        // so the host itself has to look like a host.
        return \is_string($host) && preg_match('/^[a-z\d]([a-z\d.-]*[a-z\d])?$/i', $host) === 1 ? $url : '';
    }
}
