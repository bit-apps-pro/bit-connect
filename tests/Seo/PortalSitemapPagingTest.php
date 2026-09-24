<?php

namespace BitApps\BitConnect\Tests\Seo;

use BitApps\BitConnect\Config;
use BitApps\BitConnect\Enum\SeoSettings;
use BitApps\BitConnect\Enum\Taxonomies;
use BitApps\BitConnect\Services\PortalLocation;
use BitApps\BitConnect\SSR\Seo\PortalSitemap;
use PHPUnit\Framework\TestCase;
use WP_Term;

/**
 * How the portal splits itself into sitemaps, and whether every sitemap it
 * advertises is one it will actually serve.
 *
 * The portal publishes one sitemap per content type — topics, then a taxonomy's
 * term archives — indexed at a single URL, the way core splits its own
 * (`wp-sitemap-posts-post-1.xml`) and every SEO plugin splits theirs. It began
 * as one flat list of everything, which answered no question a reader arriving
 * at the index actually has.
 *
 * A sitemap makes two promises: that the URLs it lists exist, and that the
 * sitemaps its index lists exist. Both were breakable — `urlsPerPage` capped the
 * standalone feed instead of paging it, the page count ignored both the leading
 * entries and `includeTopics`, and the leading entries were added on top of a
 * full page of topics rather than out of its budget.
 *
 * @internal
 *
 * @coversNothing
 */
final class PortalSitemapPagingTest extends TestCase
{
    protected function setUp(): void
    {
        $GLOBALS['__wp_options'] = [
            Config::withPrefix('portal_page') => 'community',
            Config::withPrefix('general_settings') => [
                'portalAccess' => 'everyone',
            ],
        ];
        $GLOBALS['__wp_home_url'] = 'https://example.com';
        $GLOBALS['__wp_filters'] = [];
        $GLOBALS['__wp_posts'] = [];
        $GLOBALS['__wp_terms'] = [];
        $GLOBALS['__wp_post_counts'] = ['publish' => 0];
        $GLOBALS['__wp_added_rewrite_rules'] = [];

        PortalLocation::resetCache();
        PortalSitemap::flushCache();
    }

    protected function tearDown(): void
    {
        $GLOBALS['__wp_terms'] = [];
        $GLOBALS['__wp_post_counts'] = ['publish' => 0];

        PortalLocation::resetCache();
        PortalSitemap::flushCache();
    }

    // -----------------------------------------------------------------------
    // One sitemap per content type.
    // -----------------------------------------------------------------------

    public function testTopicsAndEachPopulatedTaxonomyGetTheirOwnSitemap(): void
    {
        $GLOBALS['__wp_post_counts'] = ['publish' => 12];
        $GLOBALS['__wp_terms'] = [
            $this->makeTerm('billing', Taxonomies::TOPIC_TYPES->value),
            $this->makeTerm('mobile', Taxonomies::TAGS->value),
        ];

        $this->assertSame(['topics', 'topic', 'tag'], PortalSitemap::subtypes());
    }

    /**
     * A type with nothing in it would render an empty urlset, so the index must
     * not claim it exists.
     */
    public function testATaxonomyWithNoTermsGetsNoSitemap(): void
    {
        $GLOBALS['__wp_post_counts'] = ['publish' => 3];

        $this->assertSame(['topics'], PortalSitemap::subtypes());
    }

    public function testATaxonomyExcludedFromTheSitemapGetsNoSitemap(): void
    {
        $this->store(['sitemap' => ['archives' => ['tag' => false]]]);
        $GLOBALS['__wp_terms'] = [$this->makeTerm('mobile', Taxonomies::TAGS->value)];

        $this->assertNotContains('tag', PortalSitemap::subtypes());
    }

    public function testExcludedTopicsGetNoSitemapOfTheirOwn(): void
    {
        $this->store(['sitemap' => ['includeHome' => false, 'includeTopics' => false]]);
        $GLOBALS['__wp_post_counts'] = ['publish' => 5000];
        $GLOBALS['__wp_terms'] = [$this->makeTerm('mobile', Taxonomies::TAGS->value)];

        $this->assertSame(['tag'], PortalSitemap::subtypes());
    }

    /**
     * The landing page rides with the topics rather than in a sitemap of its
     * own — the same place core puts the front page.
     */
    public function testThePortalHomeKeepsTheTopicsSitemapAliveOnItsOwn(): void
    {
        $this->store(['sitemap' => ['includeHome' => true, 'includeTopics' => false]]);

        $this->assertSame(['topics'], PortalSitemap::subtypes());
        $this->assertSame(
            [['loc' => 'https://example.com/community']],
            PortalSitemap::urls('topics', 1)
        );
    }

    public function testAnEmptyPortalPublishesNoSitemapsAtAll(): void
    {
        $this->store(['sitemap' => ['includeHome' => false, 'includeTopics' => false]]);

        $this->assertSame([], PortalSitemap::subtypes());
    }

    // -----------------------------------------------------------------------
    // Each sitemap has a URL per page.
    // -----------------------------------------------------------------------

    /**
     * Without a per-type route `urlsPerPage` silently truncates the feed: the
     * index URL can only ever render one list, and on an install where an SEO
     * plugin owns wp-sitemap.xml this feed is the portal's only sitemap.
     */
    public function testFeedRegistersRoutesForTheIndexAndTheTypedPages(): void
    {
        PortalSitemap::registerFeedRewrite();

        $this->assertArrayHasKey(
            '^bit-connect-sitemap\.xml$',
            $GLOBALS['__wp_added_rewrite_rules']
        );
        $this->assertArrayHasKey(
            '^bit-connect-sitemap-([a-z\d_-]+)-([0-9]+)\.xml$',
            $GLOBALS['__wp_added_rewrite_rules']
        );
    }

    public function testTypedPageRouteCarriesBothTheTypeAndThePageNumber(): void
    {
        PortalSitemap::registerFeedRewrite();

        $target = $GLOBALS['__wp_added_rewrite_rules']['^bit-connect-sitemap-([a-z\d_-]+)-([0-9]+)\.xml$'];

        $this->assertStringContainsString('bit_connect_sitemap=1', $target);
        $this->assertStringContainsString('bit_connect_sitemap_type=$matches[1]', $target);
        $this->assertStringContainsString('bit_connect_sitemap_page=$matches[2]', $target);
    }

    /**
     * A query var that is not on the allow-list is never populated, so the
     * route above would resolve to the index regardless of the URL requested.
     */
    public function testTheTypeAndPageQueryVarsAreAllowed(): void
    {
        $vars = PortalSitemap::addFeedQueryVar([]);

        $this->assertContains('bit_connect_sitemap', $vars);
        $this->assertContains('bit_connect_sitemap_type', $vars);
        $this->assertContains('bit_connect_sitemap_page', $vars);
    }

    public function testEachSitemapIsNamedAfterWhatItLists(): void
    {
        $this->assertSame(
            'https://example.com/bit-connect-sitemap-tag-1.xml',
            PortalSitemap::feedPageUrl('tag', 1)
        );
        $this->assertSame(
            'https://example.com/bit-connect-sitemap-topics-3.xml',
            PortalSitemap::feedPageUrl('topics', 3)
        );

        // The index keeps the unnumbered URL, so the robots.txt line and any
        // submitted sitemap stay valid as the community grows.
        $this->assertSame('https://example.com/bit-connect-sitemap.xml', PortalSitemap::feedUrl());
    }

    // -----------------------------------------------------------------------
    // Paging, per type.
    // -----------------------------------------------------------------------

    public function testTopicsAreDividedByTheConfiguredPageSize(): void
    {
        $this->store(['sitemap' => ['includeHome' => false, 'urlsPerPage' => 100]]);
        $GLOBALS['__wp_post_counts'] = ['publish' => 250];

        $this->assertSame(3, (new PortalSitemap())->get_max_num_pages('topics'));
    }

    /**
     * A taxonomy pages by itself now, so a large vocabulary cannot push another
     * type's first page over `urlsPerPage` — or over the 50,000 URLs a sitemap
     * may legally carry.
     */
    public function testATaxonomyPagesIndependentlyOfTheTopics(): void
    {
        $this->store(['sitemap' => ['urlsPerPage' => 100]]);
        $this->seedTags(250);
        $GLOBALS['__wp_post_counts'] = ['publish' => 250];

        $provider = new PortalSitemap();

        $this->assertSame(3, $provider->get_max_num_pages('tag'));
        // 1 landing page + 250 topics, and the tags do not touch this budget.
        $this->assertSame(3, $provider->get_max_num_pages('topics'));
    }

    /**
     * The landing page takes a slot out of page 1's budget rather than sitting
     * on top of a full page of topics.
     */
    public function testThePortalHomeConsumesTopicBudget(): void
    {
        $this->store(['sitemap' => ['includeHome' => true, 'urlsPerPage' => 100]]);
        $GLOBALS['__wp_post_counts'] = ['publish' => 100];

        // 1 + 100 = 101 entries, so two pages. Counting topics alone would have
        // answered one, and served 101 URLs on a page declared to hold 100.
        $this->assertSame(2, (new PortalSitemap())->get_max_num_pages('topics'));
    }

    public function testATaxonomySitemapListsItsArchivesOnePageAtATime(): void
    {
        $this->store(['sitemap' => ['urlsPerPage' => 100]]);
        $this->seedTags(150);

        $this->assertCount(100, PortalSitemap::urls('tag', 1));
        $this->assertCount(50, PortalSitemap::urls('tag', 2));
        $this->assertSame([], PortalSitemap::urls('tag', 3));
    }

    public function testATaxonomySitemapCarriesOnlyItsOwnArchives(): void
    {
        $this->seedTags(2);
        $GLOBALS['__wp_terms'][] = $this->makeTerm('billing', Taxonomies::TOPIC_TYPES->value);
        PortalSitemap::flushCache();

        foreach (PortalSitemap::urls('tag', 1) as $entry) {
            $this->assertStringContainsString('/tag/', $entry['loc']);
        }

        $this->assertSame(
            [['loc' => 'https://example.com/community/topic/billing']],
            PortalSitemap::urls('topic', 1)
        );
    }

    /**
     * A type the portal does not publish is not an empty sitemap, it is a URL
     * that does not exist — the renderer turns this into a 404.
     */
    public function testAnUnknownTypeHasNoPagesAndNoUrls(): void
    {
        $GLOBALS['__wp_post_counts'] = ['publish' => 10];

        $provider = new PortalSitemap();

        $this->assertSame(0, $provider->get_max_num_pages('nonsense'));
        $this->assertSame(0, $provider->get_max_num_pages('tag'));
        $this->assertSame([], PortalSitemap::urls('nonsense', 1));
    }

    // -----------------------------------------------------------------------
    // What core is handed.
    // -----------------------------------------------------------------------

    public function testCoreIsHandedTheSameTypesKeyedByName(): void
    {
        $GLOBALS['__wp_post_counts'] = ['publish' => 4];
        $this->seedTags(2);

        $subtypes = (new PortalSitemap())->get_object_subtypes();

        $this->assertSame(['topics', 'tag'], array_keys($subtypes));
        $this->assertSame('tag', $subtypes['tag']->name);
    }

    /**
     * The whole portal is one line in `wp-sitemap.xml`, pointing at its own
     * index, rather than a `wp-sitemap-bitconnectportal-*` line per type among
     * core's posts, pages and users.
     */
    public function testTheWordPressIndexGetsOneGroupedEntry(): void
    {
        $GLOBALS['__wp_post_counts'] = ['publish' => 4];
        $this->seedTags(2);

        $entries = (new PortalSitemap())->get_sitemap_entries();

        $this->assertCount(1, $entries);
        $this->assertSame('https://example.com/bit-connect-sitemap.xml', $entries[0]['loc']);
        $this->assertArrayHasKey('lastmod', $entries[0]);
    }

    public function testTheGroupedEntryIsOmittedWhenThePortalPublishesNothing(): void
    {
        $this->store(['sitemap' => ['includeHome' => false, 'includeTopics' => false]]);

        $this->assertSame([], (new PortalSitemap())->get_sitemap_entries());
    }

    /**
     * Grouping nests a sitemap index inside one, which no specification
     * documents either way. The filter is the way back to a flat listing.
     */
    public function testTheFlatPerTypeListingIsAvailableThroughAFilter(): void
    {
        $GLOBALS['__wp_post_counts'] = ['publish' => 4];
        $this->seedTags(2);
        $GLOBALS['__wp_filters']['bit_connect_sitemap_index_grouped'] = false;

        $locs = array_column((new PortalSitemap())->get_sitemap_entries(), 'loc');

        $this->assertSame(
            [
                'https://example.com/wp-sitemap-bitconnectportal-topics-1.xml',
                'https://example.com/wp-sitemap-bitconnectportal-tag-1.xml',
            ],
            $locs
        );
    }

    // -----------------------------------------------------------------------
    // The browser view.
    // -----------------------------------------------------------------------

    /**
     * Both documents must name the stylesheet, or following one of these URLs
     * shows the raw document tree and Firefox's "does not appear to have any
     * style information" banner.
     */
    public function testBothDocumentShapesPointAtTheStylesheet(): void
    {
        $GLOBALS['__wp_post_counts'] = ['publish' => 1];
        $this->seedTags(1);

        $expected = '<?xml-stylesheet type="text/xsl" href="https://example.com/bit-connect-sitemap.xsl" ?>';

        $this->assertStringContainsString($expected, $this->render('index'));
        $this->assertStringContainsString($expected, $this->render('feed', 'tag'));
    }

    public function testTheStylesheetIsServedAtItsOwnRoute(): void
    {
        PortalSitemap::registerFeedRewrite();

        $this->assertSame(
            'index.php?bit_connect_sitemap_xsl=1',
            $GLOBALS['__wp_added_rewrite_rules']['^bit-connect-sitemap\.xsl$'] ?? ''
        );
        $this->assertContains('bit_connect_sitemap_xsl', PortalSitemap::addFeedQueryVar([]));
    }

    public function testTheStylesheetIsWellFormedXml(): void
    {
        $document = new \DOMDocument();

        $this->assertTrue($document->loadXML($this->stylesheet()));
    }

    /**
     * The real proof: run the stylesheet over each document shape and check a
     * table of links comes out. A stylesheet that parses but selects nothing —
     * the usual outcome of getting the sitemap namespace prefix wrong — would
     * render an empty page and pass a well-formedness check.
     */
    public function testTheStylesheetRendersTheIndexAsLinks(): void
    {
        $GLOBALS['__wp_post_counts'] = ['publish' => 2];
        $this->seedTags(1);

        $html = $this->transform($this->render('index'));

        $this->assertStringContainsString('<table', $html);
        $this->assertStringContainsString(
            '<a href="https://example.com/bit-connect-sitemap-tag-1.xml">',
            $html
        );
    }

    public function testTheStylesheetRendersAUrlsetAsLinks(): void
    {
        $this->seedTags(2);

        $html = $this->transform($this->render('feed', 'tag'));

        $this->assertStringContainsString('<a href="https://example.com/community/tag/tag-1">', $html);
        $this->assertStringContainsString('<a href="https://example.com/community/tag/tag-2">', $html);
    }

    // -----------------------------------------------------------------------
    // Helpers.
    // -----------------------------------------------------------------------

    /**
     * The XML the feed would serve, without going through template_redirect.
     */
    private function render(string $shape, string $subtype = ''): string
    {
        $method = new \ReflectionMethod(PortalSitemap::class, $shape === 'index' ? 'printIndex' : 'printFeed');
        $method->setAccessible(true);

        ob_start();
        $shape === 'index'
            ? $method->invoke(null)
            : $method->invoke(null, PortalSitemap::urls($subtype, 1));

        return (string) ob_get_clean();
    }

    private function stylesheet(): string
    {
        $method = new \ReflectionMethod(PortalSitemap::class, 'printStylesheet');
        $method->setAccessible(true);

        ob_start();
        $method->invoke(null);

        return (string) ob_get_clean();
    }

    private function transform(string $xml): string
    {
        $stylesheet = new \DOMDocument();
        $stylesheet->loadXML($this->stylesheet());

        $source = new \DOMDocument();
        $source->loadXML($xml);

        $processor = new \XSLTProcessor();
        $processor->importStylesheet($stylesheet);

        return (string) $processor->transformToXml($source);
    }

    /**
     * @param array<string, mixed> $settings
     */
    private function store(array $settings): void
    {
        $GLOBALS['__wp_options'][Config::withPrefix(SeoSettings::OPTION_NAME->value)] = $settings;

        PortalSitemap::flushCache();
    }

    private function makeTerm(string $slug, string $taxonomy): WP_Term
    {
        $term = new WP_Term();
        $term->term_id = \count($GLOBALS['__wp_terms'] ?? []) + 1;
        $term->slug = $slug;
        $term->name = ucfirst($slug);
        $term->taxonomy = $taxonomy;
        $term->count = 1;

        return $term;
    }

    private function seedTags(int $count): void
    {
        $terms = [];

        for ($index = 1; $index <= $count; ++$index) {
            $terms[] = $this->makeTerm('tag-' . $index, Taxonomies::TAGS->value);
        }

        $GLOBALS['__wp_terms'] = $terms;

        PortalSitemap::flushCache();
    }
}
