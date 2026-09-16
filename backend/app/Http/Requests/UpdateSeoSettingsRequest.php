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
 * @property bool   $serverRendering
 * @property int    $ssrTopicLimit
 * @property string $metaOwner
 * @property bool   $schemaDiscussion
 * @property bool   $schemaBreadcrumbs
 * @property array  $archives
 * @property array  $indexArchives
 * @property bool   $indexProfiles
 * @property bool   $indexPagination
 * @property array  $sitemap
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
            'serverRendering'       => ['nullable', 'boolean'],
            'ssrTopicLimit'         => ['nullable', 'integer', 'min:1', 'max:200'],
            'metaOwner'             => ['nullable', 'string'],
            'schemaDiscussion'      => ['nullable', 'boolean'],
            'schemaBreadcrumbs'     => ['nullable', 'boolean'],
            'archives'              => ['nullable', 'array'],
            'archives.*'            => ['nullable', 'boolean'],
            'indexArchives'         => ['nullable', 'array'],
            'indexArchives.*'       => ['nullable', 'boolean'],
            'indexProfiles'         => ['nullable', 'boolean'],
            'indexPagination'       => ['nullable', 'boolean'],
            'sitemap'               => ['nullable', 'array'],
            'sitemap.enabled'       => ['nullable', 'boolean'],
            'sitemap.inRobotsTxt'   => ['nullable', 'boolean'],
            'sitemap.includeHome'   => ['nullable', 'boolean'],
            'sitemap.includeTopics' => ['nullable', 'boolean'],
            'sitemap.urlsPerPage'   => ['nullable', 'integer', 'min:100', 'max:50000'],
            'sitemap.archives'      => ['nullable', 'array'],
            'sitemap.archives.*'    => ['nullable', 'boolean'],
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

        $data = [
            'serverRendering'   => $this->flag('serverRendering', $defaults['serverRendering']),
            'ssrTopicLimit'     => $this->limit($defaults['ssrTopicLimit']),
            'metaOwner'         => $this->owner($defaults['metaOwner']),
            'schemaDiscussion'  => $this->flag('schemaDiscussion', $defaults['schemaDiscussion']),
            'schemaBreadcrumbs' => $this->flag('schemaBreadcrumbs', $defaults['schemaBreadcrumbs']),
            'indexProfiles'     => $this->flag('indexProfiles', $defaults['indexProfiles']),
            'indexPagination'   => $this->flag('indexPagination', $defaults['indexPagination']),
            'archives'          => $this->group('archives', $defaults['archives']),
            'indexArchives'     => $this->group('indexArchives', $defaults['indexArchives']),
            'sitemap'           => $this->group('sitemap', $defaults['sitemap']),
        ];

        $sitemap = \is_array($this->sitemap) ? $this->sitemap : [];

        // The only sitemap value that is not a switch, so it is clamped rather
        // than coerced to a boolean by the group helper above.
        $data['sitemap']['urlsPerPage'] = isset($sitemap['urlsPerPage'])
            ? max(100, min(50000, (int) $sitemap['urlsPerPage']))
            : $defaults['sitemap']['urlsPerPage'];

        // Per-taxonomy sitemap inclusion, one level below the rest.
        $postedArchives = \is_array($sitemap['archives'] ?? null) ? $sitemap['archives'] : [];
        $data['sitemap']['archives'] = [];

        foreach ($defaults['sitemap']['archives'] as $segment => $default) {
            $data['sitemap']['archives'][$segment] = \array_key_exists($segment, $postedArchives)
                ? self::toBool($postedArchives[$segment])
                : $default;
        }

        return $data;
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
            // Nested maps and the numeric page size are handled by the caller;
            // this helper only flattens switches.
            if (\is_array($default) || \is_int($default)) {
                $values[$key] = $default;

                continue;
            }

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

    private function limit(int $default): int
    {
        if ($this->ssrTopicLimit === null || $this->ssrTopicLimit === '') {
            return $default;
        }

        // Clamped here as well as on read: this bounds the size of every portal
        // page response, so an out-of-range value should never reach the option.
        return max(1, min(200, (int) $this->ssrTopicLimit));
    }

    private function owner(string $default): string
    {
        $allowed = [SeoSettings::OWNER_AUTO, SeoSettings::OWNER_PLUGIN, SeoSettings::OWNER_SEO_PLUGIN];

        return \in_array($this->metaOwner, $allowed, true) ? $this->metaOwner : $default;
    }
}
