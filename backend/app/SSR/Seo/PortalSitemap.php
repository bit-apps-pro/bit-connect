<?php

namespace BitApps\BitConnect\SSR\Seo;

use BitApps\BitConnect\Config;
use BitApps\BitConnect\Deps\BitApps\WPKit\Hooks\Hooks;
use BitApps\BitConnect\Enum\PostTypes;
use BitApps\BitConnect\Enum\SeoSettings;
use BitApps\BitConnect\Enum\Taxonomies;
use BitApps\BitConnect\Services\PortalLocation;
use BitApps\BitConnect\Services\PortalTaxonomies;
use WP_Post_Type;
use WP_Query;
use WP_Sitemaps_Provider;
use WP_Taxonomy;
use WP_Term;

if (!\defined('ABSPATH')) {
    exit;
}

/**
 * Points the WordPress core sitemap at the portal, not at the CPT.
 *
 * Core sitemaps list every public post type at its own permalink, which for
 * topics is `/bit-connect/{slug}` — a bare theme page whose canonical points at
 * the portal route. Left alone, the sitemap sends crawlers to URLs the
 * canonical immediately disowns, while the portal URLs appear in no sitemap at
 * all. This provider replaces the CPT entries with the portal's own routes and
 * 301s the CPT permalink to its portal equivalent, so every signal — sitemap,
 * canonical, redirect — agrees on one URL per topic.
 */
final class PortalSitemap extends WP_Sitemaps_Provider
{
    private const FEED_QUERY_VAR = 'bit_connect_sitemap';

    public function __construct()
    {
        // Core's sitemap rewrite pattern only routes provider names matching
        // [a-z]+ — hyphens or digits in the name make the sitemap URL 404.
        $this->name = 'bitconnectportal';
        $this->object_type = 'post';
    }

    /**
     * Hook everything. Called once from the provider bootstrap.
     */
    public static function register(): void
    {
        // The CPT's own permalinks are never the canonical topic URL, so they
        // leave the sitemap regardless of portal visibility.
        Hooks::addFilter('wp_sitemaps_post_types', [self::class, 'removeCptFromSitemap']);
        Hooks::addFilter('wp_sitemaps_taxonomies', [self::class, 'removeInternalTaxonomies']);

        // Core collects providers on wp_sitemaps_init.
        Hooks::addAction('wp_sitemaps_init', [self::class, 'registerProvider']);

        Hooks::addAction('template_redirect', [self::class, 'redirectCptPermalink']);

        // The theme's own term archives are superseded by the portal's. Left
        // alone they stay indexable while every link on them 301s elsewhere.
        Hooks::addAction('template_redirect', [self::class, 'redirectTermArchive']);

        // Every major SEO plugin replaces `wp-sitemap.xml` with its own index,
        // which takes the provider above out of service and leaves the portal
        // in no sitemap at all. The standalone feed below is served regardless
        // of who owns the index, and is advertised in robots.txt — the one
        // discovery channel no plugin can switch off.
        Hooks::addAction('init', [self::class, 'registerFeedRewrite'], 11);
        Hooks::addFilter('query_vars', [self::class, 'addFeedQueryVar']);
        Hooks::addAction('template_redirect', [self::class, 'maybeRenderFeed'], 0);
        Hooks::addFilter('robots_txt', [self::class, 'advertiseInRobotsTxt'], 10, 2);

        // Yoast's index is filterable, so the feed can also be listed there
        // rather than relying on robots.txt alone.
        Hooks::addFilter('wpseo_sitemap_index', [self::class, 'appendToYoastIndex']);

        // Keep the CPT's own permalinks out of the SEO plugins' sitemaps for the
        // same reason they are removed from core's.
        Hooks::addFilter('wpseo_sitemap_exclude_post_type', [self::class, 'excludeCptFromSeoPlugin'], 10, 2);
        Hooks::addFilter('rank_math/sitemap/exclude_post_type', [self::class, 'excludeCptFromSeoPlugin'], 10, 2);
    }

    /**
     * Absolute URL of the standalone portal sitemap.
     */
    public static function feedUrl(): string
    {
        return home_url('/bit-connect-sitemap.xml');
    }

    /**
     * Serve the standalone feed at a real `.xml` path.
     */
    public static function registerFeedRewrite(): void
    {
        $regex = '^bit-connect-sitemap\.xml$';

        add_rewrite_rule($regex, 'index.php?' . self::FEED_QUERY_VAR . '=1', 'top');

        // Same one-time persistence as the profile rewrite: a rule added at
        // runtime stays inert until the option is rebuilt.
        $stored = get_option('rewrite_rules');

        if (\is_array($stored) && !isset($stored[$regex])) {
            flush_rewrite_rules(false);
        }
    }

    /**
     * Allow the feed marker through WordPress's query var allow-list.
     *
     * @param array<int, string> $vars
     *
     * @return array<int, string>
     */
    public static function addFeedQueryVar($vars)
    {
        $vars[] = self::FEED_QUERY_VAR;

        return $vars;
    }

    /**
     * Render the standalone sitemap when its URL was requested.
     */
    public static function maybeRenderFeed(): void
    {
        if (get_query_var(self::FEED_QUERY_VAR) === '') {
            return;
        }

        if (!self::hasPublicPortal()) {
            status_header(404);

            exit;
        }

        $page = max(1, (int) get_query_var('paged'));

        header('Content-Type: application/xml; charset=UTF-8', true);
        status_header(200);

        echo self::renderFeed(self::urls($page)); // phpcs:ignore Generic.PHP.ForbiddenFunctions.FoundWithAlternative, WordPress.Security.EscapeOutput.OutputNotEscaped

        exit;
    }

    /**
     * Point crawlers at the standalone feed.
     *
     * A `Sitemap:` line in robots.txt is how search engines discover sitemaps
     * they were never explicitly submitted, and robots.txt is core WordPress —
     * so this survives whichever SEO plugin owns the sitemap index.
     *
     * @param string $output
     * @param bool   $public
     *
     * @return string
     */
    public static function advertiseInRobotsTxt($output, $public)
    {
        if (!$public || !self::hasPublicPortal() || !SeoSettings::sitemap('inRobotsTxt')) {
            return $output;
        }

        return $output . 'Sitemap: ' . esc_url_raw(self::feedUrl()) . "\n";
    }

    /**
     * Add the feed to Yoast's sitemap index.
     *
     * @param string $index
     *
     * @return string
     */
    public static function appendToYoastIndex($index)
    {
        if (!self::hasPublicPortal()) {
            return $index;
        }

        $url = esc_url(self::feedUrl());
        $lastmod = esc_html(self::latestModified());

        return $index . '<sitemap><loc>' . $url . '</loc><lastmod>' . $lastmod . '</lastmod></sitemap>' . "\n";
    }

    /**
     * Drop the topic CPT from an SEO plugin's own sitemap.
     *
     * @param bool   $excluded
     * @param string $postType
     *
     * @return bool
     */
    public static function excludeCptFromSeoPlugin($excluded, $postType)
    {
        return $postType === PostTypes::BIT_CONNECT->value ? true : $excluded;
    }

    /**
     * Expose the portal sitemap only when there is a portal and it is public.
     */
    public static function registerProvider(): void
    {
        if (!self::hasPublicPortal()) {
            return;
        }

        wp_register_sitemap_provider('bitconnectportal', new self());
    }

    /**
     * Drop the CPT's own permalinks from the core post-type sitemap.
     *
     * @param array<string, WP_Post_Type> $postTypes
     *
     * @return array<string, WP_Post_Type>
     */
    public static function removeCptFromSitemap($postTypes)
    {
        unset($postTypes[PostTypes::BIT_CONNECT->value]);

        return $postTypes;
    }

    /**
     * The plugin's taxonomies (stages, statuses, …) are portal-internal
     * filters; their theme term archives are not part of the portal experience
     * and should not be crawled.
     *
     * @param array<string, WP_Taxonomy> $taxonomies
     *
     * @return array<string, WP_Taxonomy>
     */
    public static function removeInternalTaxonomies($taxonomies)
    {
        foreach (Taxonomies::cases() as $taxonomy) {
            unset($taxonomies[$taxonomy->value]);
        }

        return $taxonomies;
    }

    /**
     * 301 the CPT permalink to the portal route.
     *
     * Applies whenever a portal is configured — also under a restricted portal,
     * where the bare CPT page would otherwise hand the topic body to logged-out
     * visitors that the portal itself refuses.
     */
    public static function redirectCptPermalink(): void
    {
        if (!is_singular(PostTypes::BIT_CONNECT->value)) {
            return;
        }

        $portalPage = (string) Config::getOption('portal_page', '');
        if ($portalPage === '') {
            return;
        }

        $slug = get_post_field('post_name', get_queried_object_id());
        if (!\is_string($slug) || $slug === '') {
            return;
        }

        wp_safe_redirect(SeoContent::portalUrl($slug), 301);

        exit;
    }

    /**
     * Portal URLs for one sitemap page: the landing page plus published topics.
     *
     * Method name is fixed by the WP_Sitemaps_Provider contract.
     *
     * @param int $pageNum
     * @param string $objectSubtype
     *
     * @return array<int, array<string, string>>
     */
    public function get_url_list($pageNum, $objectSubtype = '') // phpcs:ignore PSR1.Methods.CamelCapsMethodName.NotCamelCaps, VariableAnalysis.CodeAnalysis.VariableAnalysis.UnusedVariable
    {
        return self::urls((int) $pageNum);
    }

    /**
     * Portal URLs for one sitemap page: the landing page plus published topics.
     *
     * Shared by the core sitemap provider and the standalone feed so both
     * advertise exactly the same set — two sitemaps disagreeing about which
     * URLs exist is worse than either one alone.
     *
     * @return array<int, array<string, string>>
     */
    public static function urls(int $pageNum): array
    {
        $query = new WP_Query(
            [
                'post_type'              => PostTypes::BIT_CONNECT->value,
                'post_status'            => 'publish',
                'posts_per_page'         => SeoSettings::sitemapUrlsPerPage(),
                'paged'                  => max(1, (int) $pageNum),
                'orderby'                => 'modified',
                'order'                  => 'DESC',
                'no_found_rows'          => true,
                'update_post_meta_cache' => false,
                'update_post_term_cache' => false,
            ]
        );

        $urls = [];

        // The portal landing page and the term archives lead the first sitemap
        // page. Archives are hubs rather than leaves — advertising them is what
        // gets the clusters crawled, not just the individual topics.
        if ((int) $pageNum === 1) {
            if (SeoSettings::sitemap('includeHome')) {
                $urls[] = ['loc' => SeoContent::portalUrl()];
            }

            foreach (self::archiveUrls() as $archiveUrl) {
                $urls[] = ['loc' => $archiveUrl];
            }
        }

        // In root mode a topic shares the URL space with pages and posts, and
        // they win. Advertising a shadowed topic would point crawlers at a URL
        // that serves something else entirely.
        $shadowed = PortalLocation::isServingAtRoot()
            ? self::shadowedSlugs(array_column($query->posts, 'post_name'))
            : [];

        foreach ($query->posts as $post) {
            if (!SeoSettings::sitemap('includeTopics') || isset($shadowed[$post->post_name])) {
                continue;
            }

            $entry = ['loc' => SeoContent::portalUrl($post->post_name)];

            if (!empty($post->post_modified_gmt) && $post->post_modified_gmt !== '0000-00-00 00:00:00') {
                $entry['lastmod'] = gmdate(DATE_W3C, strtotime($post->post_modified_gmt . ' UTC'));
            }

            $urls[] = $entry;
        }

        return $urls;
    }

    /**
     * Number of sitemap pages needed for the published topics.
     *
     * Method name is fixed by the WP_Sitemaps_Provider contract.
     *
     * @param string $objectSubtype
     *
     * @return int
     */
    public function get_max_num_pages($objectSubtype = '') // phpcs:ignore PSR1.Methods.CamelCapsMethodName.NotCamelCaps, VariableAnalysis.CodeAnalysis.VariableAnalysis.UnusedVariable
    {
        $counts = wp_count_posts(PostTypes::BIT_CONNECT->value);
        $published = (int) ($counts->publish ?? 0);

        return max(1, (int) ceil($published / SeoSettings::sitemapUrlsPerPage()));
    }

    /**
     * 301 a theme term archive to the portal's own archive for that term.
     */
    public static function redirectTermArchive(): void
    {
        if (!is_tax(array_values(PortalTaxonomies::map()))) {
            return;
        }

        if ((string) Config::getOption('portal_page', '') === '') {
            return;
        }

        $term = get_queried_object();

        if (!$term instanceof WP_Term) {
            return;
        }

        $url = PortalTaxonomies::urlForTerm($term);

        if ($url === '') {
            return;
        }

        wp_safe_redirect($url, 301);

        exit;
    }

    /**
     * Which of these slugs WordPress content already owns at the site root.
     *
     * Only top-level pages and posts can take a single-segment URL: a child page
     * lives at `/parent/child`, so it leaves `/child` free. One query for the
     * whole sitemap page rather than a lookup per topic.
     *
     * @param string[] $slugs
     *
     * @return array<string, true>
     */
    private static function shadowedSlugs(array $slugs): array
    {
        $slugs = array_values(array_unique(array_filter($slugs)));

        if (empty($slugs)) {
            return [];
        }

        $query = new WP_Query(
            [
                'post_type'              => ['page', 'post'],
                'post_status'            => 'publish',
                'post_name__in'          => $slugs,
                'posts_per_page'         => \count($slugs),
                'no_found_rows'          => true,
                'update_post_meta_cache' => false,
                'update_post_term_cache' => false,
            ]
        );

        $shadowed = [];

        foreach ($query->posts as $post) {
            if ($post->post_type === 'page' && (int) $post->post_parent !== 0) {
                continue;
            }

            $shadowed[$post->post_name] = true;
        }

        return $shadowed;
    }

    /**
     * Portal URLs of every term archive that has topics in it.
     *
     * Filtered per taxonomy by the SEO settings, and never listing an archive
     * that carries `noindex`. Empty archives are left out too: a hub with
     * nothing to link to is not worth a crawl, and it would rank for the term
     * with a blank page.
     *
     * @return array<int, string>
     */
    private static function archiveUrls(): array
    {
        $urls = [];

        foreach (PortalTaxonomies::map() as $segment => $taxonomy) {
            if (!SeoSettings::sitemapArchive($segment)) {
                continue;
            }

            $terms = get_terms(
                [
                    'taxonomy'   => $taxonomy,
                    'hide_empty' => true,
                    'fields'     => 'slugs',
                ]
            );

            if (is_wp_error($terms) || !\is_array($terms)) {
                continue;
            }

            foreach ($terms as $slug) {
                $urls[] = PortalTaxonomies::url($segment, (string) $slug);
            }
        }

        return $urls;
    }

    /**
     * A urlset document for the given entries.
     *
     * @param array<int, array<string, string>> $urls
     */
    private static function renderFeed(array $urls): string
    {
        $xml = '<?xml version="1.0" encoding="UTF-8"?>' . "\n"
            . '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">' . "\n";

        foreach ($urls as $entry) {
            if (empty($entry['loc'])) {
                continue;
            }

            $xml .= '<url><loc>' . esc_url($entry['loc']) . '</loc>';

            if (!empty($entry['lastmod'])) {
                $xml .= '<lastmod>' . esc_html($entry['lastmod']) . '</lastmod>';
            }

            $xml .= '</url>' . "\n";
        }

        return $xml . '</urlset>';
    }

    /**
     * When the newest topic last changed, for the sitemap index entry.
     */
    private static function latestModified(): string
    {
        $query = new WP_Query(
            [
                'post_type'              => PostTypes::BIT_CONNECT->value,
                'post_status'            => 'publish',
                'posts_per_page'         => 1,
                'orderby'                => 'modified',
                'order'                  => 'DESC',
                'no_found_rows'          => true,
                'update_post_meta_cache' => false,
                'update_post_term_cache' => false,
            ]
        );

        $modified = $query->posts[0]->post_modified_gmt ?? '';

        if ($modified === '' || $modified === '0000-00-00 00:00:00') {
            return gmdate(DATE_W3C);
        }

        return gmdate(DATE_W3C, strtotime($modified . ' UTC'));
    }

    private static function hasPublicPortal(): bool
    {
        // Keyed to the portal being public rather than to the rendered markup:
        // a sitemap is worth publishing even with the HTML fallback switched
        // off, because JavaScript-rendering crawlers reach these URLs anyway.
        return (string) Config::getOption('portal_page', '') !== ''
            && SeoContent::isPortalPublic()
            && (bool) SeoSettings::sitemap('enabled');
    }
}
