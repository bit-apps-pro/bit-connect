<?php

namespace BitApps\BitConnect\Tests\Seo;

use BitApps\BitConnect\Config;
use BitApps\BitConnect\Services\PortalLocation;
use BitApps\BitConnect\SSR\Seo\SeoMeta;
use BitApps\BitConnect\SSR\Seo\SeoPluginBridge;
use PHPUnit\Framework\TestCase;
use Yoast\WP\SEO\Presenters\Canonical_Presenter;
use Yoast\WP\SEO\Presenters\Open_Graph\Title_Presenter as OpenGraphTitlePresenter;
use Yoast\WP\SEO\Presenters\Robots_Presenter;
use Yoast\WP\SEO\Presenters\Schema_Presenter;
use Yoast\WP\SEO\Presenters\Title_Presenter;
use Yoast\WP\SEO\Presenters\Webmaster\Google_Presenter;

require_once \dirname(__DIR__) . '/doubles/yoast-presenters.php';

/**
 * Proves the site's SEO plugin stands down on portal routes and nowhere else.
 *
 * An SEO plugin only ever sees the portal *page* — the topic routes are served
 * by the portal's own router and never enter the main query. Left alone it
 * stamps the portal page's canonical, robots and schema onto every topic URL.
 * These tests assert that on a matched route the plugin keeps only its title,
 * fed the route's, and that everywhere else its output passes through
 * untouched.
 *
 * @internal
 *
 * @coversNothing
 */
final class SeoPluginBridgeTest extends TestCase
{
    private const PORTAL_PAGE_ID = 7;

    protected function setUp(): void
    {
        $GLOBALS['__wp_options'] = [
            Config::withPrefix('portal_page') => 'community',
            Config::withPrefix('general_settings') => [
                'portalAccess'   => 'everyone',
                'communityTitle' => 'Acme Community',
                'logoLight'      => 'https://example.com/logo.png',
            ],
        ];
        $GLOBALS['__wp_home_url'] = 'https://example.com';
        $GLOBALS['__wp_bloginfo'] = ['name' => 'Acme'];
        $GLOBALS['__wp_filters'] = [];
        $GLOBALS['__wp_filter_callbacks'] = [];
        $GLOBALS['__wp_actions'] = [];
        $GLOBALS['__wp_removed_actions'] = [];
        $GLOBALS['__wp_removed_all_actions'] = [];
        $GLOBALS['__wp_thumbnails'] = [];
        $GLOBALS['__wp_site_icon'] = '';
        $GLOBALS['__wp_posts'] = [$this->makePortalPage()];

        $this->resetMeta();

        PortalLocation::resetCache();

        SeoPluginBridge::register();
    }

    protected function tearDown(): void
    {
        $GLOBALS['__wp_posts'] = [];

        PortalLocation::resetCache();
    }

    // -----------------------------------------------------------------------
    // The title is the one thing the plugin keeps, and it carries the route's.
    // -----------------------------------------------------------------------

    public function testEveryPluginTitleIsTheTopicTitle(): void
    {
        SeoMeta::forTopic($this->makeTopic());

        foreach (['wpseo_title', 'rank_math/frontend/title', 'aioseo_title'] as $filter) {
            $this->assertSame(
                'How do I reset my password',
                $this->filter($filter, 'Community — Acme'),
                $filter
            );
        }
    }

    // -----------------------------------------------------------------------
    // Everything else the plugin would say about the portal page goes.
    // -----------------------------------------------------------------------

    public function testYoastKeepsOnlyItsTitleAndVerificationTags(): void
    {
        SeoMeta::forTopic($this->makeTopic());

        $kept = $this->filter('wpseo_frontend_presenters', [
            new Title_Presenter(),
            new Canonical_Presenter(),
            new Robots_Presenter(),
            new OpenGraphTitlePresenter(),
            new Schema_Presenter(),
            new Google_Presenter(),
        ]);

        $this->assertSame(
            [Title_Presenter::class, Google_Presenter::class],
            array_map('get_class', $kept)
        );
    }

    public function testYoastRobotsAreEmptiedOnARoute(): void
    {
        // Yoast merges these into core's robots tag outside its presenters.
        SeoMeta::forTopic($this->makeTopic());

        $this->assertSame([], $this->filter('wpseo_robots_array', ['index' => 'index']));
    }

    public function testAioseoKeepsItsMetaViewButLosesSocialAndSchema(): void
    {
        SeoMeta::forTopic($this->makeTopic());

        $views = $this->filter('aioseo_meta_views', [
            'meta'    => 'meta.php',
            'social'  => 'social.php',
            'schema'  => 'schema.php',
            'clarity' => 'clarity.php',
        ]);

        // The meta view carries the site verification tags; clarity is analytics.
        $this->assertSame(['meta' => 'meta.php', 'clarity' => 'clarity.php'], $views);
    }

    public function testAioseoMetaViewIsEmptiedOfEveryRouteDescribingValue(): void
    {
        SeoMeta::forTopic($this->makeTopic());

        $this->assertSame('', $this->filter('aioseo_description', 'The Acme community.'));
        $this->assertSame('', $this->filter('aioseo_canonical_url', 'https://example.com/community'));
        $this->assertSame('', $this->filter('aioseo_prev_link', 'https://example.com/community/2'));
        $this->assertSame([], $this->filter('aioseo_robots_meta', ['index' => 'index']));
    }

    public function testSeoPressHeadLoadersAreUnhookedOnARoute(): void
    {
        SeoMeta::forTopic($this->makeTopic());

        SeoPluginBridge::standDownHeadOutput();

        $removed = $GLOBALS['__wp_removed_actions']['wp_head'] ?? [];
        $this->assertContains('seopress_load_titles_options', $removed);
        $this->assertContains('seopress_load_social_options', $removed);

        // Its newer classes defer to the legacy path just unhooked.
        $this->assertTrue($this->filter('seopress_old_pre_get_document_title', false));
        $this->assertTrue($this->filter('seopress_old_wp_head_description', false));
    }

    public function testTheNoindexProfileRouteLeaksNoPortalCanonical(): void
    {
        // A profile has no canonical of its own. Handing the plugin's value
        // through here once printed the portal page's canonical on a noindex
        // route — the pairing that can carry noindex to the home page.
        SeoMeta::forProfile('Casey');

        $this->assertSame('', $this->filter('aioseo_canonical_url', 'https://example.com/community'));
        $this->assertSame([Title_Presenter::class], array_map(
            'get_class',
            $this->filter('wpseo_frontend_presenters', [new Title_Presenter(), new Canonical_Presenter()])
        ));
    }

    // -----------------------------------------------------------------------
    // Everything the bridge must leave alone.
    // -----------------------------------------------------------------------

    public function testOrdinaryPagesArePassedThroughUntouched(): void
    {
        // No route described itself, so this request is a normal page or post
        // and belongs entirely to the SEO plugin.
        $presenters = [new Title_Presenter(), new Canonical_Presenter()];

        $this->assertSame($presenters, $this->filter('wpseo_frontend_presenters', $presenters));
        $this->assertSame('About — Acme', $this->filter('wpseo_title', 'About — Acme'));
        $this->assertSame('https://example.com/about', $this->filter('aioseo_canonical_url', 'https://example.com/about'));
        $this->assertFalse($this->filter('seopress_old_pre_get_document_title', false));

        SeoPluginBridge::standDownHeadOutput();

        $this->assertSame([], $GLOBALS['__wp_removed_actions']);
    }

    public function testTheStandDownFilterLeavesThePluginInPlace(): void
    {
        $GLOBALS['__wp_filters']['bit_connect_seo_plugin_stand_down'] = false;
        SeoMeta::forTopic($this->makeTopic());

        $presenters = [new Title_Presenter(), new Canonical_Presenter()];

        $this->assertSame($presenters, $this->filter('wpseo_frontend_presenters', $presenters));
        $this->assertFalse(SeoPluginBridge::standsDown());
    }

    public function testAnUnexpectedShapeIsReturnedUntouched(): void
    {
        SeoMeta::forTopic($this->makeTopic());

        $this->assertSame('not-an-array', $this->filter('aioseo_meta_views', 'not-an-array'));
        $this->assertSame('not-an-array', $this->filter('wpseo_frontend_presenters', 'not-an-array'));
    }

    // -----------------------------------------------------------------------
    // SeoMeta prints the tags the plugin no longer does.
    // -----------------------------------------------------------------------

    public function testSeoMetaEmitsSocialTagsAndCanonicalOnARoute(): void
    {
        SeoMeta::forTopic($this->makeTopic());
        $head = SeoMeta::head();

        $this->assertStringContainsString('og:title', $head);
        $this->assertStringContainsString('rel="canonical"', $head);
    }

    public function testTheSocialTagsFilterCanStillSilenceThem(): void
    {
        $GLOBALS['__wp_filters']['bit_connect_seo_social_tags'] = false;

        SeoMeta::forTopic($this->makeTopic());
        $head = SeoMeta::head();

        $this->assertStringNotContainsString('og:title', $head);
        $this->assertStringContainsString('DiscussionForumPosting', $head);
    }

    public function testNoSeoPluginIsDetectedInAPlainInstall(): void
    {
        $this->assertSame('', SeoPluginBridge::detect());
    }

    /**
     * Run every callback registered against a filter, as WordPress would.
     *
     * @param mixed $value
     *
     * @return mixed
     */
    private function filter(string $tag, $value)
    {
        foreach ($GLOBALS['__wp_filter_callbacks'][$tag] ?? [] as $callback) {
            $value = $callback($value);
        }

        return $value;
    }

    /**
     * @return array<string, mixed>
     */
    private function makeTopic(): array
    {
        return [
            'ID'                => 1,
            'post_title'        => 'How do I reset my password',
            'post_name'         => 'how-do-i',
            'post_status'       => 'publish',
            'post_content'      => 'You can reset it from the account page.',
            'post_excerpt'      => '',
            'post_date'         => '2026-03-04 10:00:00',
            'post_date_gmt'     => '2026-03-04 10:00:00',
            'post_modified_gmt' => '2026-03-05 09:00:00',
            'author_name'       => 'Casey',
            'comments_count'    => 0,
        ];
    }

    private function makePortalPage(): \WP_Post
    {
        $page = new \WP_Post();
        $page->ID = self::PORTAL_PAGE_ID;
        $page->post_name = 'community';
        $page->post_type = 'page';
        $page->post_status = 'publish';

        return $page;
    }

    private function resetMeta(): void
    {
        $reflection = new \ReflectionClass(SeoMeta::class);
        $reflection->getProperty('meta')->setValue(null, null);
    }
}
