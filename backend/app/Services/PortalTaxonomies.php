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
     * Segments the portal already routes besides its archives, which an
     * archive segment would shadow or be shadowed by: the list's own
     * pagination, member profiles and the notifications page.
     */
    private const ROUTED_SEGMENTS = ['page', 'user', 'notifications'];

    /**
     * Archive key => taxonomy name.
     *
     * The key is what SEO settings and sitemap names store, so it never
     * changes. It is also the URL segment, except for an archive a plugin
     * names otherwise through TopicTaxonomies — see slugFor().
     *
     * Built in a method rather than a class constant: these are backed enum
     * cases, and reading `->value` is not a constant expression.
     *
     * @return array<string, string>
     */
    public static function map(): array
    {
        // Every segment is always served: the sidebar links to stage archives
        // and topic pages link to their terms, so an archive that 404s strands
        // the portal's own links. Whether search sees one is isIndexable().
        $map = self::builtIn();

        foreach (TopicTaxonomies::all() as $entry) {
            if ($entry['archive'] !== '' && !isset($map[$entry['archive']])) {
                $map[$entry['archive']] = $entry['taxonomy'];
            }
        }

        return $map;
    }

    /**
     * Whether a URL segment is one an added archive may not take.
     */
    public static function isReservedSegment(string $segment): bool
    {
        return isset(self::builtIn()[$segment]) || \in_array($segment, self::ROUTED_SEGMENTS, true);
    }

    /**
     * Whether a segment's archives belong in the index.
     *
     * Set per segment on the SEO screen. The shipped defaults index the subject
     * taxonomies — topic type and tag — because those are what people
     * search for and their archives are the cluster pages worth ranking, and
     * stage, because the sidebar navigates by it: those archives are the pages
     * every other page in the portal links to, so they carry the internal
     * linking that makes a page rankable in the first place. `status` stays
     * out — nobody searches "needs approval", and nothing links to it, so an
     * archive per status is a thin, constantly-churning listing of topics
     * already indexed individually.
     *
     * Every archive still works for visitors either way; one kept out of the
     * index is marked noindex and left out of the sitemap.
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
     * Whether a segment's archives belong in the sitemap.
     *
     * Exactly the indexable ones, read *filtered*, so the two answers cannot
     * disagree: a site that opens stage archives through
     * `bit_connect_archive_indexable` gets them advertised as well as indexed,
     * and one that closes a subject taxonomy through the same filter drops out
     * of the sitemap instead of being listed as a URL the head marks noindex.
     * An indexable page left out of the sitemap would only be found later.
     */
    public static function isSitemapListed(string $segment): bool
    {
        return self::isIndexable($segment);
    }

    /**
     * Every archive key.
     *
     * @return array<int, string>
     */
    public static function segments(): array
    {
        return array_keys(self::map());
    }

    /**
     * The URL segment an archive key is served under, e.g. `tag`.
     */
    public static function slugFor(string $segment): string
    {
        foreach (TopicTaxonomies::all() as $entry) {
            if ($entry['archive'] === $segment) {
                return $entry['slug'];
            }
        }

        return $segment;
    }

    /**
     * What an archive's terms are called, plural, e.g. `Tags`.
     */
    public static function labelFor(string $segment): string
    {
        foreach (TopicTaxonomies::all() as $entry) {
            if ($entry['archive'] === $segment) {
                return $entry['plural'];
            }
        }

        $taxonomy = get_taxonomy(self::taxonomyFor($segment));

        return $taxonomy ? (string) $taxonomy->labels->name : $segment;
    }

    /**
     * The archive key a URL segment addresses, or '' when it addresses none.
     */
    public static function segmentForSlug(string $slug): string
    {
        foreach (self::segments() as $segment) {
            if (self::slugFor($segment) === $slug) {
                return $segment;
            }
        }

        return '';
    }

    /**
     * A regex alternation of the URL segments, e.g. `topic|tag|stage`, for
     * building rewrite rules and route patterns.
     */
    public static function segmentPattern(): string
    {
        $slugs = array_map([self::class, 'slugFor'], self::segments());

        // An archive served under a segment other than its key stays routable
        // at the key, so its old URLs reach renamedArchiveUrl() and redirect
        // instead of 404ing.
        $slugs = [...$slugs, ...self::segments()];

        return implode('|', array_map('preg_quote', array_unique($slugs)));
    }

    /**
     * Where `/{key}/{slug}` now lives when that archive is served under a
     * segment of its own, or '' when that URL is not one.
     *
     * Search engines and shared links keep pointing at the segment the archive
     * started under, so a rename redirects them rather than 404ing each one.
     * Only that original segment is remembered: a later rename of a rename
     * leaves the intermediate name unrouted.
     */
    public static function renamedArchiveUrl(string $urlSegment, string $termSlug): string
    {
        if (self::taxonomyFor($urlSegment) === '' || self::slugFor($urlSegment) === $urlSegment) {
            return '';
        }

        return self::resolve(self::slugFor($urlSegment), $termSlug) === null ? '' : self::url($urlSegment, $termSlug);
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
     * The term behind `/{urlSegment}/{slug}`, or null when nothing matches.
     *
     * Takes the segment as it appears in the URL, not the archive key.
     *
     * Returning null is what keeps a mistyped archive URL a genuine 404 rather
     * than an empty page answering 200 — the same rule the topic routes follow.
     */
    public static function resolve(string $urlSegment, string $termSlug): ?WP_Term
    {
        $taxonomy = self::taxonomyFor(self::segmentForSlug($urlSegment));

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
        // In the site's permalink form, like SeoContent::portalUrl(): this is
        // the archive's canonical, sitemap entry and redirect target, and a
        // missing trailing slash would make each of them a 301.
        return user_trailingslashit(PortalLocation::url(self::slugFor($segment) . '/' . $termSlug));
    }

    /**
     * Portal URL of the archive a term belongs to, or '' when it has none.
     */
    public static function urlForTerm(WP_Term $term): string
    {
        $segment = self::segmentFor($term->taxonomy);

        return $segment === '' ? '' : self::url($segment, $term->slug);
    }

    /**
     * This plugin's own archives.
     *
     * @return array<string, string>
     */
    private static function builtIn(): array
    {
        return [
            'topic'  => Taxonomies::TOPIC_TYPES->value,
            'tag'    => Taxonomies::TAGS->value,
            'stage'  => Taxonomies::STAGES->value,
            'status' => Taxonomies::STATUSES->value,
        ];
    }
}
