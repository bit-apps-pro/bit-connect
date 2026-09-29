<?php

declare(strict_types=1);

namespace BitApps\BitConnect\Services;

// Prevent direct script access
if (!defined('ABSPATH')) {
    exit;
}

use BitApps\BitConnect\Deps\BitApps\WPKit\Hooks\Hooks;

/**
 * What the departments taxonomy is called, and the URL segment its archives
 * answer to.
 *
 * One place, because the name used to drift: the data said "departments", the
 * screens said "Products", the topic form said "Products/Department" and the
 * archives lived at `/department/…`. Every label and link now reads from here.
 *
 * The stored taxonomy never changes with the name — `bit-connect-departments`
 * is an identifier, not a label — so the name can be changed through
 * `bit_connect_department_naming` without moving a single term. A value that
 * would break the portal is ignored field by field rather than taken as given:
 * an empty label, or a segment another archive already answers to.
 */
final class DepartmentNaming
{
    /**
     * The stable key the departments archive is known by — in PortalTaxonomies,
     * in SEO settings and in sitemap names — whatever its URL segment is.
     */
    public const KEY = 'department';

    /**
     * Segments the portal already routes, which a department segment would
     * shadow or be shadowed by: the other archives, the list's own pagination,
     * member profiles and the notifications page.
     */
    private const RESERVED_SEGMENTS = ['topic', 'tag', 'stage', 'status', 'page', 'user', 'notifications'];

    /**
     * @return array{singular: string, plural: string, slug: string}
     */
    public static function get(): array
    {
        $defaults = self::defaults();
        $filtered = Hooks::applyFilter('bit_connect_department_naming', $defaults);
        $naming = \is_array($filtered) ? $filtered : [];

        return [
            'singular' => self::label($naming['singular'] ?? '', $defaults['singular']),
            'plural'   => self::label($naming['plural'] ?? '', $defaults['plural']),
            'slug'     => self::segment($naming['slug'] ?? '', $defaults['slug']),
        ];
    }

    /**
     * The URL segment of the departments archive, e.g. `department`.
     */
    public static function slug(): string
    {
        return self::get()['slug'];
    }

    /**
     * @return array{singular: string, plural: string, slug: string}
     */
    public static function defaults(): array
    {
        return [
            'singular' => __('Department', 'bit-connect'),
            'plural'   => __('Departments', 'bit-connect'),
            'slug'     => self::KEY,
        ];
    }

    /**
     * Whether a segment is one the departments archive may not take.
     */
    public static function isReservedSegment(string $segment): bool
    {
        return \in_array($segment, self::RESERVED_SEGMENTS, true);
    }

    /**
     * @param mixed $value
     */
    private static function label($value, string $fallback): string
    {
        $label = \is_string($value) ? trim(sanitize_text_field($value)) : '';

        return $label === '' ? $fallback : $label;
    }

    /**
     * @param mixed $value
     */
    private static function segment($value, string $fallback): string
    {
        $segment = \is_string($value) ? sanitize_title($value) : '';

        return $segment === '' || self::isReservedSegment($segment) ? $fallback : $segment;
    }
}
