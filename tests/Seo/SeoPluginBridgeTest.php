<?php

namespace BitApps\BitConnect\Tests\Seo;

use BitApps\BitConnect\Config;
use BitApps\BitConnect\Services\PortalLocation;
use BitApps\BitConnect\SSR\Seo\SeoMeta;
use BitApps\BitConnect\SSR\Seo\SeoPluginBridge;
use PHPUnit\Framework\TestCase;

/**
 * Proves the portal's route data reaches whichever SEO plugin owns the head.
 *
 * An SEO plugin only ever sees the portal *page* — the topic routes are served
 * by the portal's own router and never enter the main query. Left alone it
 * stamps the portal page's canonical onto every topic URL, which collapses the
 * whole community into one indexable page. These tests assert the opposite: on
 * a matched route the plugin is handed the route's own values, and everywhere
 * else its own output passes through untouched.
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
    // The damage the bridge exists to prevent.
    // -----------------------------------------------------------------------

    public function testCanonicalIsRewrittenToTheTopicNotThePortalPage(): void
    {
        SeoMeta::forTopic($this->makeTopic());

        // What Yoast would have emitted: the portal page's own URL, on every
        // single topic.
        $result = $this->filter('wpseo_canonical', 'https://example.com/community');

        $this->assertSame('https://example.com/community/how-do-i', $result);
    }

    public function testTitleIsRewrittenToTheTopicTitle(): void
    {
        SeoMeta::forTopic($this->makeTopic());

        $this->assertSame(
            'How do I reset my password',
            $this->filter('wpseo_title', 'Community — Acme')
        );
    }

    public function testRankMathReceivesTheSameRouteData(): void
    {
        SeoMeta::forTopic($this->makeTopic());

        $this->assertSame(
            'https://example.com/community/how-do-i',
            $this->filter('rank_math/frontend/canonical', 'https://example.com/community')
        );
        $this->assertSame(
            'How do I reset my password',
            $this->filter('rank_math/opengraph/facebook/og_title', 'Community')
        );
    }

    public function testSeoPressReceivesTheSameRouteData(): void
    {
        SeoMeta::forTopic($this->makeTopic());

        $this->assertSame(
            'https://example.com/community/how-do-i',
            $this->filter('seopress_titles_canonical', 'https://example.com/community')
        );
    }

    public function testListRouteCanonicalisesToTheBarePortalUrl(): void
    {
        SeoMeta::forTopics([$this->makeTopic()]);

        // Sort and filter query strings are all the same set of topics in a
        // different order, so every one of them points here.
        $this->assertSame(
            'https://example.com/community',
            $this->filter('wpseo_canonical', 'https://example.com/community?sort=newest')
        );
    }

    // -----------------------------------------------------------------------
    // Everything the bridge must leave alone.
    // -----------------------------------------------------------------------

    public function testOrdinaryPagesArePassedThroughUntouched(): void
    {
        // No route described itself, so this request is a normal page or post
        // and belongs entirely to the SEO plugin.
        $this->assertSame(
            'https://example.com/about',
            $this->filter('wpseo_canonical', 'https://example.com/about')
        );
        $this->assertSame('About — Acme', $this->filter('wpseo_title', 'About — Acme'));
    }

    public function testAnEmptyRouteValueDoesNotBlankThePluginsOwn(): void
    {
        // A profile carries no description; the site-wide default is a better
        // answer than an empty tag.
        SeoMeta::forProfile('Casey');

        $this->assertSame(
            'The Acme community.',
            $this->filter('wpseo_metadesc', 'The Acme community.')
        );
    }

    public function testAioseoTagArrayIsPatchedKeyByKey(): void
    {
        SeoMeta::forTopic($this->makeTopic());

        $tags = $this->filter('aioseo_facebook_tags', [
            'og:title'     => 'Community',
            'og:url'       => 'https://example.com/community',
            'og:locale'    => 'en_US',
        ]);

        $this->assertSame('How do I reset my password', $tags['og:title']);
        $this->assertSame('https://example.com/community/how-do-i', $tags['og:url']);
        // Keys the portal has no opinion about survive.
        $this->assertSame('en_US', $tags['og:locale']);
        // Keys the plugin did not supply are not invented.
        $this->assertArrayNotHasKey('og:image', $tags);
    }

    public function testAnUnexpectedTagShapeIsReturnedUntouched(): void
    {
        SeoMeta::forTopic($this->makeTopic());

        $this->assertSame('not-an-array', $this->filter('aioseo_facebook_tags', 'not-an-array'));
    }

    // -----------------------------------------------------------------------
    // Exactly one component may own the social tags.
    // -----------------------------------------------------------------------

    public function testSeoMetaStopsEmittingSocialTagsWhenAPluginIsBridged(): void
    {
        $GLOBALS['__wp_filters']['bit_connect_seo_plugin_bridge'] = true;

        SeoMeta::forTopic($this->makeTopic());
        $head = SeoMeta::head();

        // The plugin prints these from the values fed above — printing them
        // here too would duplicate every tag.
        $this->assertStringNotContainsString('og:title', $head);
        $this->assertStringNotContainsString('rel="canonical"', $head);

        // Structured data is additive and stays regardless.
        $this->assertStringContainsString('DiscussionForumPosting', $head);
    }

    public function testSeoMetaEmitsSocialTagsWhenNoPluginIsPresent(): void
    {
        SeoMeta::forTopic($this->makeTopic());
        $head = SeoMeta::head();

        $this->assertStringContainsString('og:title', $head);
        $this->assertStringContainsString('rel="canonical"', $head);
    }

    public function testNoSeoPluginIsDetectedInAPlainInstall(): void
    {
        $this->assertSame('', SeoPluginBridge::detect());
        $this->assertFalse(SeoPluginBridge::isBridged());
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
