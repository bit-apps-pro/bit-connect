<?php

namespace BitApps\BitConnect\SSR\Seo;

use BitApps\BitConnect\Config;
use BitApps\BitConnect\Deps\BitApps\WPKit\Hooks\Hooks;
use BitApps\BitConnect\Enum\PostTypes;
use BitApps\BitConnect\Enum\SeoSettings;
use BitApps\BitConnect\Enum\Taxonomies;
use BitApps\BitConnect\Services\PortalLocation;
use BitApps\BitConnect\Services\PortalTaxonomies;
use BitApps\BitConnect\Services\StageService;
use WP_Post_Type;
use WP_Query;
use WP_Sitemaps_Provider;
use WP_Taxonomy;
use WP_Term;

if (!defined('ABSPATH')) {
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
    /**
     * The sitemap of topics, as opposed to one of a taxonomy's archives.
     *
     * Plural, and distinct from the `topic` taxonomy segment, which is the
     * topic *type* archive — they would otherwise collide in the URL.
     */
    public const SUBTYPE_TOPICS = 'topics';

    private const FEED_QUERY_VAR = 'bit_connect_sitemap';

    private const FEED_PAGE_QUERY_VAR = 'bit_connect_sitemap_page';

    private const FEED_TYPE_QUERY_VAR = 'bit_connect_sitemap_type';

    private const FEED_XSL_QUERY_VAR = 'bit_connect_sitemap_xsl';

    /**
     * Term archive URLs per taxonomy segment, for one request.
     *
     * Each sitemap is asked for its size and then for its contents, and the
     * index asks every type for its size before any of it is rendered. Without
     * this that is a get_terms() per taxonomy per question, and a type that
     * counted differently on two of them would advertise pages that do not line
     * up with what it serves.
     *
     * @var array<string, array<int, string>>
     */
    private static $archiveUrls = [];

    /**
     * The index's type list, memoised alongside the URLs above.
     *
     * @var null|array<int, string>
     */
    private static $subtypes;

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
     * Absolute URL of one page of one of the standalone sitemaps.
     *
     * Named after the content it lists — `bit-connect-sitemap-tag-1.xml` — so
     * the index reads as a table of contents rather than as a numbered pile,
     * mirroring core's own `wp-sitemap-posts-post-1.xml`.
     */
    public static function feedPageUrl(string $subtype, int $page): string
    {
        return home_url('/bit-connect-sitemap-' . $subtype . '-' . max(1, $page) . '.xml');
    }

    /**
     * Drop the memoised type list and archive URLs.
     *
     * A live request renders one sitemap and stops, so nothing in production
     * needs this. A test that changes the settings between two calls does.
     */
    public static function flushCache(): void
    {
        self::$archiveUrls = [];
        self::$subtypes = null;
    }

    /**
     * Serve the standalone feed at a real `.xml` path.
     */
    public static function registerFeedRewrite(): void
    {
        // Two rules: the index, and the per-type pages it links to. Without the
        // second `urlsPerPage` would silently *cap* the feed rather than page
        // it, because there would be no URL at which a second page could be
        // served — and on an install where an SEO plugin owns `wp-sitemap.xml`,
        // these are the only sitemaps the portal has.
        //
        // The type pattern matches core's own (`[a-z\d_-]`), so a segment that
        // is a legal sitemap name here is one there too.
        //
        // The third is the stylesheet that makes these readable in a browser.
        // Core ships one for its own sitemaps but only registers it when core
        // sitemaps are enabled, so borrowing `wp-sitemap.xsl` would 404 on
        // exactly the installs this feed exists for — the ones where an SEO
        // plugin has switched core's sitemaps off.
        $rules = [
            '^bit-connect-sitemap\.xml$'                       => 'index.php?' . self::FEED_QUERY_VAR . '=1',
            '^bit-connect-sitemap-([a-z\d_-]+)-([0-9]+)\.xml$' => 'index.php?' . self::FEED_QUERY_VAR . '=1'
                . '&' . self::FEED_TYPE_QUERY_VAR . '=$matches[1]'
                . '&' . self::FEED_PAGE_QUERY_VAR . '=$matches[2]',
            '^bit-connect-sitemap\.xsl$' => 'index.php?' . self::FEED_XSL_QUERY_VAR . '=1',
        ];

        foreach ($rules as $regex => $target) {
            add_rewrite_rule($regex, $target, 'top');
        }

        // Same one-time persistence as the profile rewrite: a rule added at
        // runtime stays inert until the option is rebuilt.
        $stored = get_option('rewrite_rules');

        if (!\is_array($stored)) {
            return;
        }

        foreach (array_keys($rules) as $regex) {
            if (!isset($stored[$regex])) {
                flush_rewrite_rules(false);

                return;
            }
        }
    }

    /**
     * Allow the feed markers through WordPress's query var allow-list.
     *
     * @param array<int, string> $vars
     *
     * @return array<int, string>
     */
    public static function addFeedQueryVar($vars)
    {
        $vars[] = self::FEED_QUERY_VAR;
        $vars[] = self::FEED_TYPE_QUERY_VAR;
        $vars[] = self::FEED_PAGE_QUERY_VAR;
        $vars[] = self::FEED_XSL_QUERY_VAR;

        return $vars;
    }

    /**
     * Render the standalone sitemap when its URL was requested.
     */
    public static function maybeRenderFeed(): void
    {
        // The stylesheet carries no site data of its own, so it is served
        // without consulting portal visibility — and before the sitemap check,
        // because it is requested by the browser rather than reached by a
        // reader following a link.
        if (get_query_var(self::FEED_XSL_QUERY_VAR) !== '') {
            header('Content-Type: application/xslt+xml; charset=UTF-8', true);
            status_header(200);

            self::printStylesheet();

            exit;
        }

        if (get_query_var(self::FEED_QUERY_VAR) === '') {
            return;
        }

        if (!self::hasPublicPortal()) {
            status_header(404);

            exit;
        }

        $subtype = (string) get_query_var(self::FEED_TYPE_QUERY_VAR);

        // The unnumbered URL is always the index — a table of contents of the
        // per-type sitemaps, like `wp-sitemap.xml` is of core's. Keeping it an
        // index whatever the portal's size means the URL in robots.txt and the
        // one submitted to Search Console never change shape.
        if ($subtype === '') {
            header('Content-Type: application/xml; charset=UTF-8', true);
            status_header(200);

            self::printIndex();

            exit;
        }

        $requested = max(1, (int) get_query_var(self::FEED_PAGE_QUERY_VAR));

        // A type that lists nothing, or a page past its end, is not an
        // empty sitemap — it is a URL that does not exist. Saying so keeps
        // a stale index entry from looking valid.
        if ($requested > self::pageCount($subtype)) {
            status_header(404);

            exit;
        }

        $urls = self::urls($subtype, $requested);

        header('Content-Type: application/xml; charset=UTF-8', true);
        status_header(200);

        self::printFeed($urls);

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
     * Portal URLs for one page of one sitemap.
     *
     * Method name is fixed by the WP_Sitemaps_Provider contract.
     *
     * @param int $pageNum
     * @param string $objectSubtype
     *
     * @return array<int, array<string, string>>
     */
    public function get_url_list($pageNum, $objectSubtype = '') // phpcs:ignore PSR1.Methods.CamelCapsMethodName.NotCamelCaps
    {
        return self::urls((string) $objectSubtype, (int) $pageNum);
    }

    /**
     * Portal URLs for one page of one sitemap.
     *
     * Shared by the core sitemap provider and the standalone feed so both
     * advertise exactly the same set — two sitemaps disagreeing about which
     * URLs exist is worse than either one alone.
     *
     * @return array<int, array<string, string>>
     */
    public static function urls(string $subtype, int $pageNum): array
    {
        if (!\in_array($subtype, self::subtypes(), true)) {
            return [];
        }

        $pageNum = max(1, $pageNum);
        $perPage = SeoSettings::sitemapUrlsPerPage();

        // The type's fixed head — the landing page, or every term archive of
        // one taxonomy — then, for the topics sitemap, the topics. Cut into
        // pages of `urlsPerPage`: the leading entries used to be added to page 1
        // *on top of* a full page of topics, so a site with a large vocabulary
        // served a first page well over the configured size, and over the 50,000
        // a sitemap may legally carry.
        $leading = self::leadingUrls($subtype);
        $leadCount = \count($leading);
        $offset = ($pageNum - 1) * $perPage;

        $urls = [];

        // Archives are hubs rather than leaves — advertising them is what gets
        // the clusters crawled, not just the individual topics.
        foreach (\array_slice($leading, $offset, $perPage) as $leadingUrl) {
            $urls[] = ['loc' => $leadingUrl];
        }

        $remaining = $perPage - \count($urls);

        if ($remaining < 1 || self::topicCount($subtype) < 1) {
            return $urls;
        }

        $query = new WP_Query(
            [
                'post_type'      => PostTypes::BIT_CONNECT->value,
                'post_status'    => 'publish',
                'posts_per_page' => $remaining,
                // Topics start where the leading entries end, so the first page
                // that carries any takes only what is left of its budget and
                // the next one resumes exactly there. `paged` cannot express
                // that, because the offset is not a multiple of the page size.
                'offset'                 => max(0, $offset - $leadCount),
                'orderby'                => 'modified',
                'order'                  => 'DESC',
                'no_found_rows'          => true,
                'update_post_meta_cache' => false,
                'update_post_term_cache' => false,
            ]
        );

        // In root mode a topic shares the URL space with pages and posts, and
        // they win. Advertising a shadowed topic would point crawlers at a URL
        // that serves something else entirely.
        $shadowed = PortalLocation::isServingAtRoot()
            ? self::shadowedSlugs(array_column($query->posts, 'post_name'))
            : [];

        foreach ($query->posts as $post) {
            if (isset($shadowed[$post->post_name])) {
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
     * Number of pages one of the sitemaps needs.
     *
     * Method name is fixed by the WP_Sitemaps_Provider contract.
     *
     * @param string $objectSubtype
     *
     * @return int
     */
    public function get_max_num_pages($objectSubtype = '') // phpcs:ignore PSR1.Methods.CamelCapsMethodName.NotCamelCaps
    {
        return self::pageCount((string) $objectSubtype);
    }

    /**
     * The sitemaps this provider exposes, keyed by name.
     *
     * Core reads the *keys* and ignores the values, but passes each value to
     * `wp_sitemaps_index_entry` subscribers, so the name goes in both.
     *
     * Method name is fixed by the WP_Sitemaps_Provider contract.
     *
     * @return array<string, object>
     */
    public function get_object_subtypes() // phpcs:ignore PSR1.Methods.CamelCapsMethodName.NotCamelCaps
    {
        $subtypes = [];

        foreach (self::subtypes() as $name) {
            $subtypes[$name] = (object) ['name' => $name];
        }

        return $subtypes;
    }

    /**
     * What the portal contributes to the WordPress sitemap index: one entry.
     *
     * The default implementation lists a URL per type per page, which put four
     * `wp-sitemap-bitconnectportal-*` lines in `wp-sitemap.xml` among core's own
     * posts, pages and users. One grouped entry instead, pointing at the
     * portal's own index, which lists the types.
     *
     * That makes the entry a sitemap index inside a sitemap index. Neither
     * sitemaps.org nor Google documents whether a listed Sitemap may itself be
     * an index — the protocol only bounds how many a index may list — so this is
     * undocumented rather than forbidden, and crawlers have been known to treat
     * it inconsistently. It is a deliberate choice of a tidy index over a
     * guaranteed-flat one; `bit_connect_sitemap_index_grouped` returns the flat
     * per-type listing for anyone who would rather not take that bet.
     *
     * The per-type URLs stay routable either way — they are simply no longer
     * advertised here. The portal's own index advertises its own copies.
     *
     * Method name is fixed by the WP_Sitemaps_Provider contract.
     *
     * @return array<int, array<string, string>>
     */
    public function get_sitemap_entries() // phpcs:ignore PSR1.Methods.CamelCapsMethodName.NotCamelCaps
    {
        if (!Hooks::applyFilter('bit_connect_sitemap_index_grouped', true)) {
            return parent::get_sitemap_entries();
        }

        // Nothing to list rather than an entry pointing at an empty index.
        if (self::subtypes() === []) {
            return [];
        }

        return [
            [
                'loc'     => self::feedUrl(),
                'lastmod' => self::latestModified(),
            ],
        ];
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
     * The sitemaps the portal publishes, in index order.
     *
     * One per content type rather than a single combined list: a reader — human
     * or crawler — opening the index wants to see "these are the tags, those are
     * the topics", and a 50,000-line list of everything mixed together answers
     * no question anyone has. It is also how core splits its own sitemaps
     * (`wp-sitemap-posts-post-1.xml`) and how every SEO plugin splits theirs.
     *
     * A type with nothing in it is left out entirely, so the index never
     * advertises a sitemap that renders an empty urlset.
     *
     * @return array<int, string>
     */
    public static function subtypes(): array
    {
        if (self::$subtypes !== null) {
            return self::$subtypes;
        }

        $subtypes = [];

        // Topics lead, with the portal landing page at their head — the same
        // place core puts the front page, in the sitemap of the content it
        // introduces rather than in one of its own.
        if (self::typeTotal(self::SUBTYPE_TOPICS) > 0) {
            $subtypes[] = self::SUBTYPE_TOPICS;
        }

        foreach (PortalTaxonomies::segments() as $segment) {
            if (self::typeTotal($segment) > 0) {
                $subtypes[] = $segment;
            }
        }

        self::$subtypes = $subtypes;

        return $subtypes;
    }

    /**
     * The fixed entries at the head of one sitemap.
     *
     * For the topics sitemap that is the portal landing page; for a taxonomy it
     * is every one of its term archives. Topics are not included — they are
     * counted and queried separately, because there can be far too many to hold
     * in memory at once.
     *
     * @return array<int, string>
     */
    private static function leadingUrls(string $subtype): array
    {
        if ($subtype !== self::SUBTYPE_TOPICS) {
            return self::archiveUrls($subtype);
        }

        return SeoSettings::sitemap('includeHome') ? [SeoContent::portalUrl()] : [];
    }

    /**
     * How many published topics this sitemap is willing to advertise.
     *
     * Only the topics sitemap carries any; a taxonomy's sitemap is its archives
     * and nothing else.
     */
    private static function topicCount(string $subtype): int
    {
        if ($subtype !== self::SUBTYPE_TOPICS || !SeoSettings::sitemap('includeTopics')) {
            return 0;
        }

        $counts = wp_count_posts(PostTypes::BIT_CONNECT->value);

        return (int) ($counts->publish ?? 0);
    }

    /**
     * Total URLs in one sitemap, across all of its pages.
     */
    private static function typeTotal(string $subtype): int
    {
        return \count(self::leadingUrls($subtype)) + self::topicCount($subtype);
    }

    /**
     * Pages needed for one sitemap.
     *
     * Zero when the type has nothing to list, which is what keeps it out of the
     * index — sizing this from the raw post count instead made an index that
     * listed pages 2…N as existing when every one of them would have rendered
     * an empty urlset.
     */
    private static function pageCount(string $subtype): int
    {
        $total = self::typeTotal($subtype);

        if ($total < 1) {
            return 0;
        }

        return max(1, (int) ceil($total / SeoSettings::sitemapUrlsPerPage()));
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
     * Portal URLs of one taxonomy's term archives.
     *
     * Filtered per taxonomy by the SEO settings, and never listing an archive
     * that carries `noindex`. Empty archives are left out too: a hub with
     * nothing to link to is not worth a crawl, and it would rank for the term
     * with a blank page.
     *
     * @return array<int, string>
     */
    private static function archiveUrls(string $segment): array
    {
        if (isset(self::$archiveUrls[$segment])) {
            return self::$archiveUrls[$segment];
        }

        $taxonomy = PortalTaxonomies::taxonomyFor($segment);

        if ($taxonomy === '' || !PortalTaxonomies::isSitemapListed($segment)) {
            return self::$archiveUrls[$segment] = [];
        }

        $terms = get_terms(
            [
                'taxonomy'   => $taxonomy,
                'hide_empty' => true,
                'fields'     => 'slugs',
            ]
        );

        if (is_wp_error($terms) || !\is_array($terms)) {
            return self::$archiveUrls[$segment] = [];
        }

        $defaultStage = $segment === 'stage' ? StageService::defaultStageSlug() : '';

        $urls = [];

        foreach ($terms as $slug) {
            // The default stage's archive 301s to the portal root, so
            // listing it would advertise a redirect as a destination.
            if ($defaultStage !== '' && (string) $slug === $defaultStage) {
                continue;
            }

            $urls[] = PortalTaxonomies::url($segment, (string) $slug);
        }

        return self::$archiveUrls[$segment] = $urls;
    }

    /**
     * Print a urlset document for the given entries, escaping each value at
     * the element that carries it.
     *
     * @param array<int, array<string, string>> $urls
     */
    private static function printFeed(array $urls): void
    {
        self::printProlog();
        printf("<urlset xmlns=\"%s\">\n", 'http://www.sitemaps.org/schemas/sitemap/0.9');

        foreach ($urls as $entry) {
            if (empty($entry['loc'])) {
                continue;
            }

            if (!empty($entry['lastmod'])) {
                printf("<url><loc>%s</loc><lastmod>%s</lastmod></url>\n", esc_url($entry['loc']), esc_html($entry['lastmod']));
            } else {
                printf("<url><loc>%s</loc></url>\n", esc_url($entry['loc']));
            }
        }

        printf('</urlset>');
    }

    /**
     * A sitemapindex document listing every type's pages, in order.
     *
     * Served at the unnumbered URL, so the `Sitemap:` line in robots.txt and
     * the entry in an SEO plugin's index stay valid however large the community
     * gets and whichever types it happens to use.
     */
    private static function printIndex(): void
    {
        $lastmod = self::latestModified();

        self::printProlog();
        printf("<sitemapindex xmlns=\"%s\">\n", 'http://www.sitemaps.org/schemas/sitemap/0.9');

        foreach (self::subtypes() as $subtype) {
            $pages = self::pageCount($subtype);

            for ($page = 1; $page <= $pages; ++$page) {
                printf(
                    "<sitemap><loc>%s</loc><lastmod>%s</lastmod></sitemap>\n",
                    esc_url(self::feedPageUrl($subtype, $page)),
                    esc_html($lastmod)
                );
            }
        }

        printf('</sitemapindex>');
    }

    /**
     * The XML declaration plus the stylesheet that renders these in a browser.
     *
     * A crawler ignores the instruction entirely; it is there so that following
     * one of these URLs shows a table rather than "This XML file does not appear
     * to have any style information associated with it."
     */
    private static function printProlog(): void
    {
        printf(
            "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n<?xml-stylesheet type=\"text/xsl\" href=\"%s\" ?>\n",
            esc_url(self::stylesheetUrl())
        );
    }

    private static function stylesheetUrl(): string
    {
        return home_url('/bit-connect-sitemap.xsl');
    }

    /**
     * The XSLT that styles both document shapes this feed serves.
     *
     * One stylesheet rather than core's two, matching on the root element, so
     * the index and the per-type sitemaps share a look without either needing
     * to know which it is.
     */
    private static function printStylesheet(): void
    {
        // Indentation is deliberately flat: an XSLT that indents its own HTML
        // output adds whitespace inside the anchors.
        $template = <<<'XSL'
            <?xml version="1.0" encoding="UTF-8"?>
            <xsl:stylesheet version="1.0"
                xmlns:xsl="http://www.w3.org/1999/XSL/Transform"
                xmlns:s="http://www.sitemaps.org/schemas/sitemap/0.9"
                exclude-result-prefixes="s">
            <xsl:output encoding="UTF-8" indent="no" method="html"/>

            <xsl:template match="/">
            <html>
            <head>
            <title>%1$s</title>
            <meta content="noindex,follow" name="robots"/>
            <style>
            :root { color-scheme: light dark; --bg: #fff; --fg: #1e1e1e; --muted: #646970; --line: #dcdcde; --row: #f6f7f7; --link: #2271b1; }
            @media (prefers-color-scheme: dark) {
            :root { --bg: #1d2327; --fg: #f0f0f1; --muted: #a7aaad; --line: #3c434a; --row: #23282d; --link: #72aee6; }
            }
            body { background: var(--bg); color: var(--fg); font: 14px/1.6 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; margin: 0; padding: 32px 16px; }
            main { margin: 0 auto; max-width: 1000px; }
            h1 { font-size: 22px; margin: 0 0 8px; }
            p { color: var(--muted); margin: 0 0 24px; }
            h2 { font-size: 14px; font-weight: 600; margin: 0 0 12px; }
            table { border: 1px solid var(--line); border-collapse: collapse; width: 100%%; }
            th, td { padding: 10px 12px; text-align: left; }
            th { border-bottom: 1px solid var(--line); font-size: 12px; letter-spacing: .02em; text-transform: uppercase; }
            tr:nth-child(even) td { background: var(--row); }
            td { border-top: 1px solid var(--line); word-break: break-all; }
            a { color: var(--link); }
            .count { color: var(--muted); font-weight: 400; }
            </style>
            </head>
            <body>
            <main>
            <h1>%1$s</h1>
            <p>%2$s</p>
            <xsl:apply-templates/>
            </main>
            </body>
            </html>
            </xsl:template>

            <xsl:template match="s:sitemapindex">
            <h2>%3$s <span class="count">(<xsl:value-of select="count(s:sitemap)"/>)</span></h2>
            <table>
            <tr><th>%5$s</th><th>%6$s</th></tr>
            <xsl:for-each select="s:sitemap">
            <tr>
            <td><a href="{s:loc}"><xsl:value-of select="s:loc"/></a></td>
            <td><xsl:value-of select="s:lastmod"/></td>
            </tr>
            </xsl:for-each>
            </table>
            </xsl:template>

            <xsl:template match="s:urlset">
            <h2>%4$s <span class="count">(<xsl:value-of select="count(s:url)"/>)</span></h2>
            <table>
            <tr><th>%5$s</th><th>%6$s</th></tr>
            <xsl:for-each select="s:url">
            <tr>
            <td><a href="{s:loc}"><xsl:value-of select="s:loc"/></a></td>
            <td><xsl:value-of select="s:lastmod"/></td>
            </tr>
            </xsl:for-each>
            </table>
            </xsl:template>

            </xsl:stylesheet>
            XSL;

        printf(
            $template, // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- a nowdoc literal; every value is escaped below.
            esc_html__('Bit Connect sitemap', 'bit-connect'),
            esc_html__('This sitemap lists the community portal for search engines. It is generated by Bit Connect.', 'bit-connect'),
            esc_html__('Sitemaps in this index', 'bit-connect'),
            esc_html__('URLs in this sitemap', 'bit-connect'),
            esc_html__('URL', 'bit-connect'),
            esc_html__('Last modified', 'bit-connect')
        );
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
