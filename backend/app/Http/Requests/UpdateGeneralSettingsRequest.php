<?php

namespace BitApps\BitConnect\Http\Requests;

if (!\defined('ABSPATH')) {
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
    /**
     * Characters kept from a line of sidebar-card copy.
     */
    private const PROMO_TEXT_MAX = 80;

    /**
     * Phrases kept from the card's rotating list.
     */
    private const PROMO_PHRASE_MAX = 10;

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
                'sort'    => self::isFilterVisible($portalFilters, 'sort'),
                'product' => self::isFilterVisible($portalFilters, 'product'),
                'tags'    => self::isFilterVisible($portalFilters, 'tags'),
            ],
            'promo' => $this->promo(),
        ];
    }

    /**
     * The credit card in the portal sidebar: its switch, its link and its copy.
     *
     * A key missing from the payload means "leave it as it is", not "reset it":
     * the onboarding form posts only the branding fields, and it must not undo
     * an admin's wording — or their deliberate opt-in.
     *
     * @return array{enabled: bool, url: string, eyebrow: string, headline: string, prefix: string, phrases: array<int, string>, cta: string}
     */
    private function promo(): array
    {
        $stored = GeneralSettings::promo(
            Config::getOption(GeneralSettings::OPTION_NAME->value)
        );

        if (!$this->has('promo')) {
            return $stored;
        }

        $posted = \is_array($this->promo) ? $this->promo : [];

        return [
            // JSON sends a real boolean, a form post sends "true"/"1"/"on".
            'enabled' => \array_key_exists('enabled', $posted)
                ? filter_var($posted['enabled'], FILTER_VALIDATE_BOOLEAN)
                : $stored['enabled'],
            // esc_url_raw drops anything outside WordPress's allowed protocols,
            // so a javascript: URL cannot reach the anchor the portal renders.
            'url' => \array_key_exists('url', $posted)
                ? esc_url_raw(trim((string) $posted['url']))
                : $stored['url'],
            'eyebrow'  => self::line($posted, 'eyebrow', $stored),
            'headline' => self::line($posted, 'headline', $stored),
            'prefix'   => self::line($posted, 'prefix', $stored),
            'phrases'  => \array_key_exists('phrases', $posted)
                ? self::phrases($posted['phrases'])
                : $stored['phrases'],
            'cta' => self::line($posted, 'cta', $stored),
        ];
    }

    /**
     * One posted line of promo copy, falling back to the stored one.
     *
     * @param array<string, mixed>  $posted
     * @param array<string, mixed>  $stored
     */
    private static function line(array $posted, string $key, array $stored): string
    {
        return \array_key_exists($key, $posted) ? self::text($posted[$key]) : (string) $stored[$key];
    }

    /**
     * One line of card copy: plain text, and short enough to sit in a 250px
     * sider without the card growing a line for every phrase in the loop.
     *
     * @param mixed $value
     */
    private static function text($value): string
    {
        return mb_substr(sanitize_text_field((string) $value), 0, self::PROMO_TEXT_MAX);
    }

    /**
     * The rotating tail of the card, in the order the admin listed them.
     *
     * Blank lines are dropped rather than stored: an empty phrase would type
     * nothing and read as the animation having stalled.
     *
     * @param mixed $value
     *
     * @return array<int, string>
     */
    private static function phrases($value): array
    {
        $phrases = \is_array($value) ? $value : [];

        $cleaned = array_filter(
            array_map([self::class, 'text'], $phrases),
            static fn (string $phrase) => $phrase !== ''
        );

        return array_values(\array_slice($cleaned, 0, self::PROMO_PHRASE_MAX));
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
