<?php

namespace BitApps\BitConnect\Services;

// Prevent direct script access
if (!defined('ABSPATH')) {
    exit;
}

use BitApps\BitConnect\Deps\BitApps\WPKit\Hooks\Hooks;
use BitApps\BitConnect\Enum\SeoSettings;
use BitApps\BitConnect\Enum\Taxonomies;
use WP_Term;

/**
 * The portal's own term archives, and the URL segment each taxonomy answers to.
 *
 * WordPress already gives every one of these taxonomies a term archive at
 * `/bit-connect-topic-types/{term}` — but it renders in the *theme*, outside the
 * portal, and lists the CPT permalinks that PortalSitemap 301s away. So the one
 * page a search engine would rank for "billing questions" is a page the portal
 * does not serve and whose every link redirects elsewhere.
 *
 * These archives replace it: a portal route per term, rendered by the portal,
 * linking to portal URLs. The taxonomy name is not used in the URL — segments
 * are short and human-readable (`/topic/billing`, not
 * `/bit-connect-topic-types/billing`), which is also what makes them worth
 * indexing.
 */
final class PortalTaxonomies
{
    /**
     * URL segment => taxonomy name.
     *
     * Built in a method rather than a class constant: these are backed enum
     * cases, and reading `->value` is not a constant expression.
     *
     * @return array<string, string>
     */
    public static function map(): array
    {
        $map = [
            'topic'      => Taxonomies::TOPIC_TYPES->value,
            'department' => Taxonomies::DEPARTMENTS->value,
            'tag'        => Taxonomies::TAGS->value,
            'stage'      => Taxonomies::STAGES->value,
            'status'     => Taxonomies::STATUSES->value,
        ];

        // A segment switched off in the SEO settings loses its route, not just
        // its index entry — a hub nobody wants crawled is not a page worth
        // serving either, and leaving the URL live would strand the links that
        // point at it. Dropping it here also changes the rewrite pattern, which
        // is what makes the rule rebuild itself.
        return array_filter(
            $map,
            static fn ($segment) => SeoSettings::archiveEnabled($segment),
            ARRAY_FILTER_USE_KEY
        );
    }

    /**
     * Whether a segment's archives belong in the index.
     *
     * Set per segment on the SEO screen. The shipped defaults index the subject
     * taxonomies — topic type, department, tag — because those are what people
     * search for and their archives are the cluster pages worth ranking, and
     * leave the workflow ones (stage, status) out: nobody searches "in progress"
     * or "needs approval", and an archive per workflow state is a thin,
     * constantly-churning listing of topics already indexed individually.
     *
     * Every archive still works for visitors either way — indexing is a separate
     * switch from whether the route is served.
     */
    public static function isIndexable(string $segment): bool
    {
        return (bool) Hooks::applyFilter(
            'bit_connect_archive_indexable',
            SeoSettings::archiveIndexable($segment),
            $segment
        );
    }

    /**
     * Every archive segment, for building rewrite rules and route patterns.
     *
     * @return array<int, string>
     */
    public static function segments(): array
    {
        return array_keys(self::map());
    }

    /**
     * A regex alternation of the segments, e.g. `topic|department|stage`.
     */
    public static function segmentPattern(): string
    {
        return implode('|', array_map('preg_quote', self::segments()));
    }

    /**
     * The taxonomy a segment addresses, or '' when the segment is not one of ours.
     */
    public static function taxonomyFor(string $segment): string
    {
        return self::map()[$segment] ?? '';
    }

    /**
     * The segment a taxonomy is addressed by, or '' when it has no archive.
     */
    public static function segmentFor(string $taxonomy): string
    {
        $segment = array_search($taxonomy, self::map(), true);

        return \is_string($segment) ? $segment : '';
    }

    /**
     * The term behind `/{segment}/{slug}`, or null when nothing matches.
     *
     * Returning null is what keeps a mistyped archive URL a genuine 404 rather
     * than an empty page answering 200 — the same rule the topic routes follow.
     */
    public static function resolve(string $segment, string $termSlug): ?WP_Term
    {
        $taxonomy = self::taxonomyFor($segment);

        if ($taxonomy === '' || $termSlug === '') {
            return null;
        }

        $term = get_term_by('slug', $termSlug, $taxonomy);

        return $term instanceof WP_Term ? $term : null;
    }

    /**
     * Portal URL of a term archive.
     */
    public static function url(string $segment, string $termSlug): string
    {
        return PortalLocation::url($segment . '/' . $termSlug);
    }

    /**
     * Portal URL of the archive a term belongs to, or '' when it has none.
     */
    public static function urlForTerm(WP_Term $term): string
    {
        $segment = self::segmentFor($term->taxonomy);

        return $segment === '' ? '' : self::url($segment, $term->slug);
    }
}
