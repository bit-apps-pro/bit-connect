<?php

namespace BitApps\BitConnect\Tests\Seo;

use BitApps\BitConnect\Config;
use BitApps\BitConnect\Enum\SeoSettings;
use BitApps\BitConnect\Http\Requests\UpdateSeoSettingsRequest;
use BitApps\BitConnect\Services\PortalLocation;
use BitApps\BitConnect\Services\PortalTaxonomies;
use BitApps\BitConnect\SSR\Seo\SeoContent;
use BitApps\BitConnect\SSR\Seo\SeoMeta;
use PHPUnit\Framework\TestCase;
use WP_Term;

/**
 * The SEO screen's settings, and what each one actually changes.
 *
 * The defaults matter as much as the behaviour: this option did not exist
 * before the screen did, so every default has to reproduce what the SEO layer
 * already did. An install that never opens the screen must be unaffected by it.
 *
 * @internal
 *
 * @coversNothing
 */
final class SeoSettingsTest extends TestCase
{
    private const PORTAL_PAGE_ID = 7;

    protected function setUp(): void
    {
        $GLOBALS['__wp_options'] = [
            Config::withPrefix('portal_page') => 'community',
            Config::withPrefix('general_settings') => [
                'portalAccess'   => 'everyone',
                'communityTitle' => 'Acme Community',
            ],
        ];
        $GLOBALS['__wp_home_url'] = 'https://example.com';
        $GLOBALS['__wp_bloginfo'] = ['name' => 'Acme'];
        $GLOBALS['__wp_filters'] = [];
        $GLOBALS['__wp_site_icon'] = '';
        $GLOBALS['__wp_thumbnails'] = [];
        $GLOBALS['__wp_posts'] = [$this->makePortalPage()];

        $this->resetMeta();

        PortalLocation::resetCache();
    }

    protected function tearDown(): void
    {
        $GLOBALS['__wp_posts'] = [];

        PortalLocation::resetCache();
    }

    // -----------------------------------------------------------------------
    // Defaults reproduce the behaviour that existed before the option.
    // -----------------------------------------------------------------------

    public function testAnInstallThatNeverSavedSettingsGetsTheOldBehaviour(): void
    {
        $this->assertTrue(SeoSettings::bool('serverRendering'));
        $this->assertTrue((bool) SeoSettings::sitemap('enabled'));
        $this->assertTrue(SeoSettings::bool('schemaDiscussion'));
        $this->assertSame(30, SeoSettings::ssrTopicLimit());
        $this->assertSame(SeoSettings::OWNER_AUTO, SeoSettings::metaOwner());

        // Routes that were never indexed stay that way.
        $this->assertFalse(SeoSettings::bool('indexProfiles'));
        $this->assertFalse(SeoSettings::bool('indexPagination'));
        $this->assertFalse(SeoSettings::archiveIndexable('stage'));
    }

    public function testASettingSavedBeforeANewOneExistedStillGetsTheNewDefault(): void
    {
        $GLOBALS['__wp_options'][Config::withPrefix('seo_settings')] = ['serverRendering' => false];

        $this->assertFalse(SeoSettings::bool('serverRendering'));
        // Never stored, so it must not read as "switched off".
        $this->assertTrue((bool) SeoSettings::sitemap('enabled'));
        $this->assertTrue(SeoSettings::archiveEnabled('tag'));
    }

    // -----------------------------------------------------------------------
    // Each setting changes something real.
    // -----------------------------------------------------------------------

    public function testServerRenderingOffStopsCrawlerContent(): void
    {
        $this->store(['serverRendering' => false]);

        $this->assertFalse(SeoContent::isEnabled());
        $this->assertSame('', SeoContent::forTopics([$this->makeTopic()]));
    }

    public function testSitemapSurvivesServerRenderingBeingOff(): void
    {
        $this->store(['serverRendering' => false]);

        // Googlebot renders JavaScript and reaches these URLs without the HTML
        // fallback, so the two are deliberately independent.
        $this->assertFalse(SeoContent::isEnabled());
        $this->assertTrue(SeoContent::isPortalPublic());
    }

    public function testAMembersOnlyPortalOverridesTheRenderingSetting(): void
    {
        $GLOBALS['__wp_options'][Config::withPrefix('general_settings')] = [
            'portalAccess' => 'logged_in',
        ];
        $this->store(['serverRendering' => true]);

        // The setting can switch rendering off, never on for content the portal
        // itself refuses to show.
        $this->assertFalse(SeoContent::isEnabled());
        $this->assertFalse(SeoContent::isPortalPublic());
    }

    public function testDisablingAnArchiveRemovesItsRouteEntirely(): void
    {
        $this->store(['archives' => ['tag' => false]]);

        $this->assertArrayNotHasKey('tag', PortalTaxonomies::map());
        $this->assertSame('', PortalTaxonomies::taxonomyFor('tag'));
        // Not just unindexed — the URL stops resolving.
        $this->assertNull(PortalTaxonomies::resolve('tag', 'anything'));
        // Checked against the segment list rather than the pattern string —
        // "tag" is a substring of "stage", so a substring assertion would pass
        // or fail for the wrong reason.
        $this->assertNotContains('tag', PortalTaxonomies::segments());
    }

    public function testIndexStageArchivesFlipsTheirRobotsTag(): void
    {
        $term = $this->makeTerm('in-progress', 'In Progress', 'bit-connect-stages');

        $this->store(['indexArchives' => ['stage' => true]]);
        SeoMeta::forArchive($term, []);
        $this->assertStringNotContainsString('noindex', SeoMeta::head());

        $this->resetMeta();
        $this->store(['indexArchives' => ['stage' => false]]);
        SeoMeta::forArchive($term, []);
        $this->assertStringContainsString('noindex,follow', SeoMeta::head());
    }

    public function testIndexProfilesFlipsTheProfileRobotsTag(): void
    {
        $this->store(['indexProfiles' => true]);
        SeoMeta::forProfile('Casey');

        $this->assertStringNotContainsString('noindex', SeoMeta::head());
    }

    public function testIndexPaginationFlipsTheDeeperPageRobotsTag(): void
    {
        $this->store(['indexPagination' => true]);
        SeoMeta::forTopics([$this->makeTopic()], 3);

        $this->assertStringNotContainsString('noindex', SeoMeta::head());
    }

    public function testSchemaTogglesSilenceOneDocumentWithoutTheOther(): void
    {
        $this->store(['schemaBreadcrumbs' => false]);
        SeoMeta::forTopic($this->makeTopic());
        $head = SeoMeta::head();

        $this->assertStringContainsString('DiscussionForumPosting', $head);
        $this->assertStringNotContainsString('BreadcrumbList', $head);
    }

    public function testMetaOwnerSeoPluginStandsDownEvenWithNoPluginInstalled(): void
    {
        $this->store(['metaOwner' => SeoSettings::OWNER_SEO_PLUGIN]);
        SeoMeta::forTopic($this->makeTopic());

        // Asking for the SEO plugin to own the head when none is installed means
        // no route tags at all. It is a real choice with a real consequence, and
        // the settings screen says so.
        $this->assertStringNotContainsString('rel="canonical"', SeoMeta::head());
    }

    public function testMetaOwnerBitConnectPrintsTagsRegardless(): void
    {
        $this->store(['metaOwner' => SeoSettings::OWNER_PLUGIN]);
        SeoMeta::forTopic($this->makeTopic());

        $this->assertStringContainsString('rel="canonical"', SeoMeta::head());
    }

    // -----------------------------------------------------------------------
    // Nothing hostile reaches the option.
    // -----------------------------------------------------------------------

    public function testTopicLimitIsClampedOnRead(): void
    {
        $this->store(['ssrTopicLimit' => 100000]);
        $this->assertSame(200, SeoSettings::ssrTopicLimit());

        $this->store(['ssrTopicLimit' => 0]);
        $this->assertSame(1, SeoSettings::ssrTopicLimit());
    }

    public function testAnUnknownMetaOwnerFallsBackToAutomatic(): void
    {
        $this->store(['metaOwner' => 'something-else']);

        $this->assertSame(SeoSettings::OWNER_AUTO, SeoSettings::metaOwner());
    }

    public function testAPartialPayloadDoesNotSwitchOffWhatItOmits(): void
    {
        $request = $this->makeUpdateRequest(['serverRendering' => false]);
        $data = $request->toSettingsData();

        $this->assertFalse($data['serverRendering']);
        // Everything unmentioned keeps its default rather than becoming false.
        $this->assertTrue($data['sitemap']['enabled']);
        $this->assertTrue($data['schemaDiscussion']);
        $this->assertTrue($data['archives']['tag']);
        $this->assertTrue($data['indexArchives']['topic']);
        $this->assertFalse($data['indexArchives']['stage']);
        $this->assertSame(2000, $data['sitemap']['urlsPerPage']);
        $this->assertSame(30, $data['ssrTopicLimit']);
    }

    public function testStringBooleansFromAFormPostAreUnderstood(): void
    {
        $request = $this->makeUpdateRequest([
            'serverRendering' => 'false',
            'indexProfiles'   => 'true',
            'archives'        => ['tag' => '0'],
        ]);
        $data = $request->toSettingsData();

        $this->assertFalse($data['serverRendering']);
        $this->assertTrue($data['indexProfiles']);
        $this->assertFalse($data['archives']['tag']);
    }

    public function testSitemapContentTypesAreControlledIndividually(): void
    {
        $this->store(['sitemap' => ['includeTopics' => false]]);

        $this->assertFalse((bool) SeoSettings::sitemap('includeTopics'));
        // Untouched keys keep their defaults.
        $this->assertTrue((bool) SeoSettings::sitemap('includeHome'));
        $this->assertTrue((bool) SeoSettings::sitemap('enabled'));
    }

    public function testSitemapArchivesAreControlledPerTaxonomy(): void
    {
        $this->store(['sitemap' => ['archives' => ['tag' => false]]]);

        $this->assertFalse(SeoSettings::sitemapArchive('tag'));
        $this->assertTrue(SeoSettings::sitemapArchive('topic'));
    }

    public function testANoindexArchiveIsNeverListedInTheSitemap(): void
    {
        // Asking for it explicitly does not override the contradiction: a
        // sitemap asks for indexing, so listing a noindex URL asks for two
        // opposite things.
        $this->store([
            'indexArchives' => ['stage' => false],
            'sitemap'       => ['archives' => ['stage' => true]],
        ]);

        $this->assertFalse(SeoSettings::sitemapArchive('stage'));
    }

    public function testAPartialSitemapPayloadKeepsItsArchiveDefaults(): void
    {
        $data = $this->makeUpdateRequest(['sitemap' => ['includeHome' => false]])->toSettingsData();

        $this->assertFalse($data['sitemap']['includeHome']);
        $this->assertTrue($data['sitemap']['archives']['tag']);
        $this->assertSame(2000, $data['sitemap']['urlsPerPage']);
    }

    public function testSitemapPageSizeIsClamped(): void
    {
        $this->store(['sitemap' => ['urlsPerPage' => 999999]]);
        $this->assertSame(50000, SeoSettings::sitemapUrlsPerPage());

        $this->store(['sitemap' => ['urlsPerPage' => 1]]);
        $this->assertSame(100, SeoSettings::sitemapUrlsPerPage());
    }

    public function testAnArchiveCannotBeIndexableWhileItsRouteIsOff(): void
    {
        $this->store([
            'archives'      => ['tag' => false],
            'indexArchives' => ['tag' => true],
        ]);

        // Indexing a route that 404s would advertise a dead URL.
        $this->assertFalse(SeoSettings::archiveIndexable('tag'));
    }

    public function testEachArchiveSegmentHasItsOwnIndexingSwitch(): void
    {
        $this->store(['indexArchives' => ['topic' => false, 'tag' => true]]);

        $this->assertFalse(PortalTaxonomies::isIndexable('topic'));
        $this->assertTrue(PortalTaxonomies::isIndexable('tag'));
    }

    public function testTopicLimitIsClampedOnWriteToo(): void
    {
        $data = $this->makeUpdateRequest(['ssrTopicLimit' => 99999])->toSettingsData();

        $this->assertSame(200, $data['ssrTopicLimit']);
    }

    /**
     * @param array<string, mixed> $settings
     */
    private function store(array $settings): void
    {
        $GLOBALS['__wp_options'][Config::withPrefix('seo_settings')] = $settings;
    }

    /**
     * @param array<string, mixed> $input
     */
    private function makeUpdateRequest(array $input): UpdateSeoSettingsRequest
    {
        $request = new UpdateSeoSettingsRequest();

        foreach ($input as $key => $value) {
            $request->{$key} = $value;
        }

        return $request;
    }

    private function makeTerm(string $slug, string $name, string $taxonomy): WP_Term
    {
        $term = new WP_Term();
        $term->term_id = crc32($slug);
        $term->slug = $slug;
        $term->name = $name;
        $term->taxonomy = $taxonomy;
        $term->description = '';

        return $term;
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
