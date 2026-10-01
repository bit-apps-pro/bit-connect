<?php

namespace BitApps\BitConnect\Http\Requests;

if (!defined('ABSPATH')) {
    exit;
}

use BitApps\BitConnect\Config;
use BitApps\BitConnect\Deps\BitApps\WPKit\Http\Request\Request;
use BitApps\BitConnect\Deps\BitApps\WPKit\Utils\Capabilities;
use BitApps\BitConnect\Enum\GeneralSettings;
use BitApps\BitConnect\Services\AuthService;

/**
 * Request input properties.
 *
 * @property string $communityTitle
 * @property string $logoLight
 * @property string $logoPermalinkMode
 * @property string $logoPermalinkCustom
 * @property string $portalAccess
 * @property array  $portalFilters
 * @property array  $promo
 */
final class UpdateGeneralSettingsRequest extends Request
{
    public function authorize()
    {
        return Capabilities::check(AuthService::CAP_MANAGE);
    }

    public function failedAuthorizationMessage(): string
    {
        if (!is_user_logged_in()) {
            return 'You must be logged in to update general settings.';
        }

        return 'You do not have permission to update general settings.';
    }

    public function rules()
    {
        return [
            'communityTitle'      => ['nullable', 'string'],
            'logoLight'           => ['nullable', 'string'],
            'logoPermalinkMode'   => ['nullable', 'string'],
            'logoPermalinkCustom' => ['nullable', 'string'],
            'portalAccess'        => ['nullable', 'string'],
            'portalFilters'       => ['nullable', 'array'],
            'promo'               => ['nullable', 'array'],
        ];
    }

    public function toSettingsData(): array
    {
        $portalFilters = \is_array($this->portalFilters) ? $this->portalFilters : [];

        return [
            'communityTitle'      => sanitize_text_field($this->communityTitle ?? ''),
            'logoLight'           => esc_url_raw($this->logoLight ?? ''),
            'logoPermalinkMode'   => \in_array($this->logoPermalinkMode, ['default', 'custom'], true) ? $this->logoPermalinkMode : 'default',
            'logoPermalinkCustom' => esc_url_raw($this->logoPermalinkCustom ?? ''),
            'portalAccess'        => \in_array($this->portalAccess, ['everyone', 'logged_in'], true) ? $this->portalAccess : 'everyone',
            'portalFilters'       => [
                'sort' => self::isFilterVisible($portalFilters, 'sort'),
                'tags' => self::isFilterVisible($portalFilters, 'tags'),
            ],
            'promo' => $this->promo(),
        ];
    }

    /**
     * The credit card in the portal sidebar: only its switch is stored — the
     * copy is the plugin's own, resolved by GeneralSettings::promo(). Anything
     * else posted under `promo` is dropped.
     *
     * A key missing from the payload means "leave it as it is", not "reset it":
     * the onboarding form posts only the branding fields, and it must not undo
     * an admin's deliberate opt-in.
     *
     * @return array{enabled: bool}
     */
    private function promo(): array
    {
        $stored = GeneralSettings::promo(
            Config::getOption(GeneralSettings::OPTION_NAME->value)
        );
        $posted = \is_array($this->promo) ? $this->promo : [];

        return [
            // JSON sends a real boolean, a form post sends "true"/"1"/"on".
            'enabled' => $this->has('promo') && \array_key_exists('enabled', $posted)
                ? filter_var($posted['enabled'], FILTER_VALIDATE_BOOLEAN)
                : $stored['enabled'],
        ];
    }

    /**
     * A portal filter is visible unless it was explicitly switched off. A key
     * missing from the payload — an older admin build, or the onboarding form
     * that posts only the branding fields — must not silently hide a control.
     */
    private static function isFilterVisible(array $filters, string $key): bool
    {
        if (!isset($filters[$key])) {
            return true;
        }

        return filter_var($filters[$key], FILTER_VALIDATE_BOOLEAN);
    }
}
