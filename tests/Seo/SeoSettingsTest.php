<?php

namespace BitApps\BitConnect\Tests\Seo;

use BitApps\BitConnect\Config;
use BitApps\BitConnect\Enum\SeoSettings;
use BitApps\BitConnect\Http\Requests\UpdateSeoSettingsRequest;
use BitApps\BitConnect\Services\PortalLocation;
use BitApps\BitConnect\Services\PortalTaxonomies;
use BitApps\BitConnect\SSR\Seo\PortalSitemap;
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
        $this->assertTrue(SeoContent::isEnabled());
        $this->assertTrue(PortalSitemap::isPublished());

        // Routes that were never indexed stay that way.
        $this->assertFalse(SeoSettings::bool('indexProfiles'));
        $this->assertFalse(SeoSettings::archiveIndexable('status'));
    }

    public function testASettingSavedBeforeANewOneExistedStillGetsTheNewDefault(): void
    {
        $GLOBALS['__wp_options'][Config::withPrefix('seo_settings')] = ['indexProfiles' => true];

        $this->assertTrue(SeoSettings::bool('indexProfiles'));
        // Never stored, so it must not read as "switched off".
        $this->assertTrue(SeoSettings::archiveIndexable('tag'));
    }

    // -----------------------------------------------------------------------
    // Each setting changes something real.
    // -----------------------------------------------------------------------

    public function testAWithdrawnServerRenderingValueNoLongerSwitchesCrawlerContentOff(): void
    {
        // Saved by the SEO screen while it still offered the switch.
        $this->store(['serverRendering' => false]);

        $this->assertTrue(SeoContent::isEnabled());
        $this->assertArrayNotHasKey('serverRendering', SeoSettings::all());
    }

    public function testTheContentFilterCanStillSwitchCrawlerContentOff(): void
    {
        $GLOBALS['__wp_filters']['bit_connect_seo_content_enabled'] = false;

        $this->assertFalse(SeoContent::isEnabled());
        $this->assertSame('', SeoContent::forTopics([$this->makeTopic()]));

        // Googlebot renders JavaScript and reaches these URLs without the HTML
        // fallback, so the sitemap is deliberately independent of it.
        $this->assertTrue(SeoContent::isPortalPublic());
    }

    public function testAMembersOnlyPortalCannotBeFilteredBackOn(): void
    {
        $GLOBALS['__wp_options'][Config::withPrefix('general_settings')] = [
            'portalAccess' => 'logged_in',
        ];
        $GLOBALS['__wp_filters']['bit_connect_seo_content_enabled'] = true;

        // The filter can switch rendering off, never on for content the portal
        // itself refuses to show.
        $this->assertFalse(SeoContent::isEnabled());
        $this->assertFalse(SeoContent::isPortalPublic());
    }

    public function testAWithdrawnRouteSwitchServesTheArchiveAsNoindex(): void
    {
        // Saved while the screen could still 404 an archive. The sidebar links
        // to stage archives, so the route comes back — hidden from search.
        $this->store(['archives' => ['stage' => false], 'indexArchives' => ['stage' => true]]);

        $this->assertContains('stage', PortalTaxonomies::segments());
        $this->assertFalse(SeoSettings::archiveIndexable('stage'));
        $this->assertArrayNotHasKey('archives', SeoSettings::all());
    }

    public function testEveryArchiveIsServedWhateverItsIndexing(): void
    {
        $this->store(['indexArchives' => ['tag' => false, 'status' => false]]);

        // Checked against the segment list rather than the pattern string —
        // "tag" is a substring of "stage", so a substring assertion would pass
        // or fail for the wrong reason.
        $this->assertContains('tag', PortalTaxonomies::segments());
        $this->assertContains('status', PortalTaxonomies::segments());
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
        SeoMeta::forProfile('Casey', 'https://example.com/community/user/casey');

        $this->assertStringNotContainsString('noindex', SeoMeta::head());
    }

    public function testAWithdrawnPaginationSettingIsDropped(): void
    {
        $this->store(['indexPagination' => false]);

        $this->assertArrayNotHasKey('indexPagination', SeoSettings::all());
    }

    public function testAWithdrawnSchemaToggleNoLongerSilencesADocument(): void
    {
        // Saved by the SEO screen while it still offered the switches.
        $this->store(['schemaDiscussion' => false, 'schemaBreadcrumbs' => false]);
        SeoMeta::forTopic($this->makeTopic());
        $head = SeoMeta::head();

        $this->assertStringContainsString('DiscussionForumPosting', $head);
        $this->assertStringContainsString('BreadcrumbList', $head);
    }

    public function testTheJsonLdFilterCanDropOneDocumentWithoutTheOther(): void
    {
        $GLOBALS['__wp_filters']['bit_connect_seo_json_ld'] = static fn ($documents) => array_filter(
            $documents,
            static fn ($document) => ($document['@type'] ?? '') !== 'BreadcrumbList'
        );
        SeoMeta::forTopic($this->makeTopic());
        $head = SeoMeta::head();

        $this->assertStringContainsString('DiscussionForumPosting', $head);
        $this->assertStringNotContainsString('BreadcrumbList', $head);
    }

    public function testAWithdrawnMetaOwnerNoLongerHandsTheHeadAway(): void
    {
        // Saved by the SEO screen while it still offered the choice. Handing the
        // head over left portal routes with no title or canonical of their own.
        $this->store(['metaOwner' => 'seo-plugin']);
        SeoMeta::forTopic($this->makeTopic());

        $this->assertStringContainsString('rel="canonical"', SeoMeta::head());
        $this->assertArrayNotHasKey('metaOwner', SeoSettings::all());
    }

    // -----------------------------------------------------------------------
    // Nothing hostile reaches the option.
    // -----------------------------------------------------------------------

    public function testAWithdrawnTopicLimitIsNotReadBack(): void
    {
        // Saved by the SEO screen while it still offered the field.
        $this->store(['ssrTopicLimit' => 100000]);

        $this->assertArrayNotHasKey('ssrTopicLimit', SeoSettings::all());
    }

    public function testAPartialPayloadDoesNotSwitchOffWhatItOmits(): void
    {
        $request = $this->makeUpdateRequest(['indexProfiles' => true]);
        $data = $request->toSettingsData();

        $this->assertTrue($data['indexProfiles']);
        // Everything unmentioned keeps its default rather than becoming false.
        $this->assertTrue($data['indexArchives']['tag']);
        $this->assertTrue($data['indexArchives']['topic']);
        $this->assertFalse($data['indexArchives']['status']);
        // The whole of what the screen saves now.
        $this->assertSame(['indexProfiles', 'indexArchives'], array_keys($data));
    }

    public function testStringBooleansFromAFormPostAreUnderstood(): void
    {
        $request = $this->makeUpdateRequest([
            'indexProfiles' => 'true',
            'indexArchives' => ['tag' => '0', 'topic' => 'true'],
        ]);
        $data = $request->toSettingsData();

        $this->assertTrue($data['indexProfiles']);
        $this->assertFalse($data['indexArchives']['tag']);
        $this->assertTrue($data['indexArchives']['topic']);
    }

    public function testAWithdrawnSitemapGroupIsDropped(): void
    {
        $this->store(['sitemap' => ['enabled' => false, 'includeTopics' => false, 'urlsPerPage' => 100]]);

        $this->assertArrayNotHasKey('sitemap', SeoSettings::all());
        $this->assertTrue(PortalSitemap::isPublished());
    }

    public function testTheSitemapListsExactlyTheIndexableArchives(): void
    {
        $this->store(['indexArchives' => ['tag' => false]]);

        $this->assertFalse(PortalTaxonomies::isSitemapListed('tag'));
        $this->assertTrue(PortalTaxonomies::isSitemapListed('topic'));
    }

    public function testAWithdrawnSitemapExclusionListsAnIndexableArchive(): void
    {
        // Saved while an indexable archive could be kept out of the sitemap —
        // which only made it slower to find.
        $this->store(['sitemap' => ['archives' => ['tag' => false]]]);

        $this->assertTrue(PortalTaxonomies::isSitemapListed('tag'));
    }

    public function testTheIndexableFilterAlsoDecidesTheSitemap(): void
    {
        // The head and the sitemap have to give the same answer. Opening stage
        // archives through the filter without this listed them as indexable
        // pages that no sitemap advertised.
        $this->store(['indexArchives' => ['stage' => false]]);

        $GLOBALS['__wp_filters']['bit_connect_archive_indexable'] = static fn ($indexable, $segment)
            => $segment === 'stage' ? true : $indexable;

        $this->assertTrue(PortalTaxonomies::isIndexable('stage'));
        $this->assertTrue(PortalTaxonomies::isSitemapListed('stage'));
    }

    public function testTheIndexableFilterCanAlsoCloseAnArchive(): void
    {
        $GLOBALS['__wp_filters']['bit_connect_archive_indexable'] = static fn ($indexable, $segment)
            => $segment === 'tag' ? false : $indexable;

        $this->assertFalse(PortalTaxonomies::isIndexable('tag'));
        $this->assertFalse(PortalTaxonomies::isSitemapListed('tag'));
    }

    public function testAPostedSitemapGroupIsNotSaved(): void
    {
        $data = $this->makeUpdateRequest(['sitemap' => ['includeHome' => false]])->toSettingsData();

        $this->assertArrayNotHasKey('sitemap', $data);
    }

    public function testEachArchiveSegmentHasItsOwnIndexingSwitch(): void
    {
        $this->store(['indexArchives' => ['topic' => false, 'tag' => true]]);

        $this->assertFalse(PortalTaxonomies::isIndexable('topic'));
        $this->assertTrue(PortalTaxonomies::isIndexable('tag'));
    }

    public function testAWithdrawnTopicLimitIsNotSaved(): void
    {
        $data = $this->makeUpdateRequest(['ssrTopicLimit' => 99999])->toSettingsData();

        $this->assertArrayNotHasKey('ssrTopicLimit', $data);
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
