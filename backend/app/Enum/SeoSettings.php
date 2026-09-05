<?php

namespace BitApps\BitConnect\Enum;

// Prevent direct script access
if (!defined('ABSPATH')) {
    exit;
}

use BitApps\BitConnect\Config;

/**
 * Every SEO behaviour an administrator can steer, in one option.
 *
 * The SEO layer shipped with sensible defaults and filter hooks, which covers
 * developers and nobody else. These are the same decisions surfaced as settings:
 * each accessor here is the default a `bit_connect_*` filter still overrides, so
 * a site with custom code keeps behaving exactly as it did.
 *
 * Defaults reproduce the behaviour that existed before this option, so an
 * install that never opens the SEO screen is unaffected by it.
 */
enum SeoSettings: string
{
    case OPTION_NAME = 'seo_settings';

    /**
     * Bit Connect prints the head tags, or the active SEO plugin does.
     */
    public const OWNER_AUTO = 'auto';

    public const OWNER_PLUGIN = 'bit-connect';

    public const OWNER_SEO_PLUGIN = 'seo-plugin';

    /**
     * The shipped behaviour, before an administrator changes anything.
     *
     * @return array<string, mixed>
     */
    public static function defaults(): array
    {
        return [
            // Plain HTML for clients that never run the React bundle.
            'serverRendering' => true,
            'ssrTopicLimit'   => 30,

            // Who owns title, canonical and the social tags. 'auto' hands them
            // to a detected SEO plugin and prints them here otherwise.
            'metaOwner' => self::OWNER_AUTO,

            // Structured data. Additive, so on unless deliberately silenced.
            'schemaDiscussion'  => true,
            'schemaBreadcrumbs' => true,

            // Term archives, by URL segment. Switching one off removes the route
            // as well as the index entry — a hub nobody wants crawled is not a
            // page worth serving either.
            'archives' => [
                'topic'      => true,
                'department' => true,
                'tag'        => true,
                'stage'      => true,
                'status'     => true,
            ],

            // Which archives are offered to the index. Subject taxonomies are
            // what people search for; stage and status are workflow states
            // nobody looks up, and their archives churn constantly.
            'indexArchives' => [
                'topic'      => true,
                'department' => true,
                'tag'        => true,
                'stage'      => false,
                'status'     => false,
            ],

            // Routes that exist for people but not for the index.
            'indexProfiles'   => false,
            'indexPagination' => false,

            // What the sitemap advertises, content type by content type — and
            // for archives, taxonomy by taxonomy.
            'sitemap' => [
                'enabled'       => true,
                'inRobotsTxt'   => true,
                'includeHome'   => true,
                'includeTopics' => true,
                'urlsPerPage'   => 2000,
                'archives'      => [
                    'topic'      => true,
                    'department' => true,
                    'tag'        => true,
                    'stage'      => true,
                    'status'     => true,
                ],
            ],
        ];
    }

    /**
     * Stored settings merged over the defaults.
     *
     * Deliberately uncached: `get_option()` is already served from WordPress's
     * options cache, so a second cache here would buy nothing and would need
     * invalidating every time the settings are saved mid-request.
     *
     * @return array<string, mixed>
     */
    public static function all(): array
    {
        $stored = Config::getOption(self::OPTION_NAME->value, []);
        $settings = array_merge(self::defaults(), \is_array($stored) ? $stored : []);

        // Merged one level deep, so an option stored before a segment existed
        // still gets that segment's default rather than a missing key read as
        // "switched off".
        foreach (['archives', 'indexArchives', 'sitemap'] as $group) {
            $settings[$group] = array_merge(
                self::defaults()[$group],
                \is_array($settings[$group] ?? null) ? $settings[$group] : []
            );
        }

        // The sitemap's own per-taxonomy map needs the same treatment one level
        // further down.
        $settings['sitemap']['archives'] = array_merge(
            self::defaults()['sitemap']['archives'],
            \is_array($settings['sitemap']['archives'] ?? null) ? $settings['sitemap']['archives'] : []
        );

        return $settings;
    }

    public static function bool(string $key): bool
    {
        return (bool) (self::all()[$key] ?? false);
    }

    public static function metaOwner(): string
    {
        $owner = self::all()['metaOwner'] ?? self::OWNER_AUTO;

        return \in_array($owner, [self::OWNER_AUTO, self::OWNER_PLUGIN, self::OWNER_SEO_PLUGIN], true)
            ? $owner
            : self::OWNER_AUTO;
    }

    /**
     * How many topics the server-rendered list carries.
     *
     * This list was once fetched unbounded, so a community with thousands of
     * topics serialised every one of them into every portal page load — for a
     * list the React app discards and refetches anyway. The value bounds both
     * the first paint and the crawler's view of a list page; the sitemap, not
     * this markup, is what makes the remaining topics discoverable.
     *
     * Clamped rather than trusted, because it bounds the size of every portal
     * page response.
     */
    public static function ssrTopicLimit(): int
    {
        $limit = (int) (self::all()['ssrTopicLimit'] ?? 30);

        return max(1, min(200, $limit));
    }

    /**
     * Whether a term archive segment is served at all.
     */
    public static function archiveEnabled(string $segment): bool
    {
        return (bool) (self::all()['archives'][$segment] ?? false);
    }

    /**
     * Whether a term archive may be indexed.
     *
     * An archive that is not served cannot be indexed either, so the route
     * setting wins — otherwise switching a route off and its indexing on would
     * advertise a URL that 404s.
     */
    public static function archiveIndexable(string $segment): bool
    {
        return self::archiveEnabled($segment)
            && (bool) (self::all()['indexArchives'][$segment] ?? false);
    }

    /**
     * A sitemap sub-setting.
     *
     * @return mixed
     */
    public static function sitemap(string $key)
    {
        return self::all()['sitemap'][$key] ?? self::defaults()['sitemap'][$key] ?? null;
    }

    /**
     * Whether a taxonomy's archives are listed in the sitemap.
     *
     * Indexability wins: a sitemap is a list of URLs asking to be indexed, so
     * advertising one that carries `noindex` asks for two opposite things.
     */
    public static function sitemapArchive(string $segment): bool
    {
        return self::archiveIndexable($segment)
            && (bool) (self::all()['sitemap']['archives'][$segment] ?? false);
    }

    /**
     * URLs per sitemap page, clamped to what a sitemap may legally carry.
     */
    public static function sitemapUrlsPerPage(): int
    {
        return max(100, min(50000, (int) self::sitemap('urlsPerPage')));
    }
}
