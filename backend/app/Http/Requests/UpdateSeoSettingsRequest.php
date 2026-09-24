<?php

namespace BitApps\BitConnect\Http\Requests;

if (!defined('ABSPATH')) {
    exit;
}

use BitApps\BitConnect\Deps\BitApps\WPKit\Http\Request\Request;
use BitApps\BitConnect\Deps\BitApps\WPKit\Utils\Capabilities as WpCapabilities;
use BitApps\BitConnect\Enum\Capabilities;
use BitApps\BitConnect\Enum\SeoSettings;

/**
 * Request input properties.
 *
 * @property array  $indexArchives
 * @property bool   $indexProfiles
 */
final class UpdateSeoSettingsRequest extends Request
{
    public function authorize()
    {
        return WpCapabilities::check(Capabilities::MANAGE->value);
    }

    public function failedAuthorizationMessage(): string
    {
        if (!is_user_logged_in()) {
            return 'You must be logged in to update SEO settings.';
        }

        return 'You do not have permission to update SEO settings.';
    }

    public function rules()
    {
        return [
            'indexArchives'   => ['nullable', 'array'],
            'indexArchives.*' => ['nullable', 'boolean'],
            'indexProfiles'   => ['nullable', 'boolean'],
        ];
    }

    /**
     * Every value normalised to the shape the accessors expect.
     *
     * A missing key falls back to its default rather than to false: a client
     * that posts a partial payload should not silently switch off the settings
     * it did not mention.
     *
     * @return array<string, mixed>
     */
    public function toSettingsData(): array
    {
        $defaults = SeoSettings::defaults();

        return [
            'indexProfiles' => $this->flag('indexProfiles', $defaults['indexProfiles']),
            'indexArchives' => $this->group('indexArchives', $defaults['indexArchives']),
        ];
    }

    /**
     * Read a boolean from either a JSON body or a form post.
     *
     * @param mixed $value
     */
    private static function toBool($value): bool
    {
        // JSON sends real booleans, but a form post sends "true"/"1"/"on".
        return filter_var($value, FILTER_VALIDATE_BOOLEAN, FILTER_NULL_ON_FAILURE) ?? (bool) $value;
    }

    /**
     * A nested group of switches, key by key.
     *
     * A key the client did not send keeps its default rather than becoming
     * false, so a partial payload cannot silently switch off what it omits.
     *
     * @param array<string, mixed> $defaults
     *
     * @return array<string, mixed>
     */
    private function group(string $property, array $defaults): array
    {
        $input = \is_array($this->{$property}) ? $this->{$property} : [];
        $values = [];

        foreach ($defaults as $key => $default) {
            $values[$key] = \array_key_exists($key, $input)
                ? self::toBool($input[$key])
                : $default;
        }

        return $values;
    }

    private function flag(string $key, bool $default): bool
    {
        $value = $this->{$key};

        return $value === null ? $default : self::toBool($value);
    }
}
