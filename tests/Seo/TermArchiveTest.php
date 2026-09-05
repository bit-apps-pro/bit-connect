<?php

namespace BitApps\BitConnect\Tests\Seo;

use BitApps\BitConnect\Config;
use BitApps\BitConnect\Enum\Taxonomies;
use BitApps\BitConnect\Services\PortalLocation;
use BitApps\BitConnect\Services\PortalTaxonomies;
use BitApps\BitConnect\SSR\Seo\SeoContent;
use BitApps\BitConnect\SSR\Seo\SeoMeta;
use PHPUnit\Framework\TestCase;
use WP_Term;

/**
 * Term archives — the portal's topic clusters.
 *
 * WordPress already gives these taxonomies term archives, but they render in the
 * theme and list CPT permalinks that 301 away, so the one page that could rank
 * for a subject was a page the portal did not serve. These assert the portal's
 * replacement: a route per term, its own heading and canonical, and links from
 * each topic back to the cluster it belongs to.
 *
 * @internal
 *
 * @coversNothing
 */
final class TermArchiveTest extends TestCase
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
            'date_format' => 'Y-m-d',
        ];
        $GLOBALS['__wp_home_url'] = 'https://example.com';
        $GLOBALS['__wp_bloginfo'] = ['name' => 'Acme'];
        $GLOBALS['__wp_filters'] = [];
        $GLOBALS['__wp_thumbnails'] = [];
        $GLOBALS['__wp_site_icon'] = '';
        $GLOBALS['__wp_posts'] = [$this->makePortalPage()];
        $GLOBALS['__wp_terms'] = [
            $this->makeTerm('billing', 'Billing', Taxonomies::TOPIC_TYPES->value),
            $this->makeTerm('in-progress', 'In Progress', Taxonomies::STAGES->value),
        ];

        $this->resetMeta();

        PortalLocation::resetCache();
    }

    protected function tearDown(): void
    {
        $GLOBALS['__wp_posts'] = [];
        $GLOBALS['__wp_terms'] = [];

        PortalLocation::resetCache();
    }

    // -----------------------------------------------------------------------
    // Segment mapping and resolution.
    // -----------------------------------------------------------------------

    public function testSegmentsMapToTheirTaxonomies(): void
    {
        $this->assertSame(Taxonomies::TOPIC_TYPES->value, PortalTaxonomies::taxonomyFor('topic'));
        $this->assertSame(Taxonomies::TAGS->value, PortalTaxonomies::taxonomyFor('tag'));
        $this->assertSame('topic', PortalTaxonomies::segmentFor(Taxonomies::TOPIC_TYPES->value));
    }

    public function testEveryTaxonomyHasAnArchiveSegment(): void
    {
        foreach (Taxonomies::cases() as $taxonomy) {
            $this->assertNotSame(
                '',
                PortalTaxonomies::segmentFor($taxonomy->value),
                $taxonomy->value . ' has no archive segment.'
            );
        }
    }

    public function testWorkflowArchivesAreServedButNotIndexedByDefault(): void
    {
        // Served, so a visitor following one gets the topics…
        $this->assertSame(Taxonomies::STATUSES->value, PortalTaxonomies::taxonomyFor('status'));
        $this->assertSame(Taxonomies::STAGES->value, PortalTaxonomies::taxonomyFor('stage'));

        // …but not offered to the index, because nobody searches for a workflow
        // state and the listing churns constantly.
        $this->assertFalse(PortalTaxonomies::isIndexable('status'));
        $this->assertFalse(PortalTaxonomies::isIndexable('stage'));
    }

    public function testAnUnknownSegmentResolvesToNothing(): void
    {
        $this->assertNull(PortalTaxonomies::resolve('notasegment', 'billing'));
    }

    public function testAnUnknownTermResolvesToNothing(): void
    {
        // What keeps a mistyped archive URL a genuine 404 instead of a blank
        // page answering 200.
        $this->assertNull(PortalTaxonomies::resolve('topic', 'no-such-term'));
    }

    public function testAKnownTermResolves(): void
    {
        $term = PortalTaxonomies::resolve('topic', 'billing');

        $this->assertInstanceOf(WP_Term::class, $term);
        $this->assertSame('Billing', $term->name);
    }

    public function testArchiveUrlIsBuiltFromTheSegmentNotTheTaxonomyName(): void
    {
        $this->assertSame(
            'https://example.com/community/topic/billing',
            PortalTaxonomies::url('topic', 'billing')
        );
    }

    // -----------------------------------------------------------------------
    // What a crawler receives.
    // -----------------------------------------------------------------------

    public function testArchiveCarriesItsOwnTitleAndCanonical(): void
    {
        $term = $this->makeTerm('billing', 'Billing', Taxonomies::TOPIC_TYPES->value);

        SeoMeta::forArchive($term, [$this->makeTopic()]);
        $head = SeoMeta::head();

        // Never the portal page's canonical — that is what collapsed every
        // route into one indexable page.
        $this->assertStringContainsString(
            '<link rel="canonical" href="https://example.com/community/topic/billing" />',
            $head
        );
        $this->assertSame(
            ['title' => 'Billing — Acme Community'],
            SeoMeta::filterTitle(['title' => 'Community — Acme'])
        );
    }

    public function testArchiveDescriptionCountsItsTopics(): void
    {
        $term = $this->makeTerm('billing', 'Billing', Taxonomies::TOPIC_TYPES->value);

        SeoMeta::forArchive($term, [$this->makeTopic(), $this->makeTopic(2)]);

        $this->assertStringContainsString(
            'content="2 discussions about Billing in the Acme Community community."',
            SeoMeta::head()
        );
    }

    public function testATermDescriptionWinsOverTheGeneratedOne(): void
    {
        $term = $this->makeTerm('billing', 'Billing', Taxonomies::TOPIC_TYPES->value);
        $term->description = 'Everything about invoices and payments.';

        SeoMeta::forArchive($term, [$this->makeTopic()]);

        $this->assertStringContainsString(
            'content="Everything about invoices and payments."',
            SeoMeta::head()
        );
    }

    public function testArchiveEmitsCollectionAndBreadcrumbStructuredData(): void
    {
        $term = $this->makeTerm('billing', 'Billing', Taxonomies::TOPIC_TYPES->value);

        SeoMeta::forArchive($term, [$this->makeTopic()]);
        $head = SeoMeta::head();

        $this->assertStringContainsString('"@type":"CollectionPage"', $head);
        $this->assertStringContainsString('"@type":"BreadcrumbList"', $head);
    }

    public function testArchiveBodyLeadsWithTheTermAsItsHeading(): void
    {
        $term = $this->makeTerm('billing', 'Billing', Taxonomies::TOPIC_TYPES->value);

        $html = SeoContent::forArchive($term, [$this->makeTopic()]);

        // The heading is what tells a crawler the page is *about* the term
        // rather than being another copy of the topic list.
        $this->assertStringContainsString('<h1 class="bc-mb-4 bc-text-xl bc-font-semibold">Billing</h1>', $html);
        $this->assertStringContainsString('How do I reset my password', $html);
    }

    public function testAnEmptyArchiveStillRendersItsHeading(): void
    {
        $term = $this->makeTerm('billing', 'Billing', Taxonomies::TOPIC_TYPES->value);

        $html = SeoContent::forArchive($term, []);

        $this->assertStringContainsString('Billing', $html);
        $this->assertStringContainsString('No topics here yet.', $html);
    }

    public function testDraftTopicsNeverReachAnArchive(): void
    {
        $term = $this->makeTerm('billing', 'Billing', Taxonomies::TOPIC_TYPES->value);
        $draft = $this->makeTopic();
        $draft['post_status'] = 'draft';
        $draft['post_title'] = 'Unpublished plans';

        $html = SeoContent::forArchive($term, [$draft]);

        $this->assertStringNotContainsString('Unpublished plans', $html);
    }

    public function testRestrictedPortalExposesNoArchive(): void
    {
        $GLOBALS['__wp_options'][Config::withPrefix('general_settings')] = [
            'portalAccess'   => 'logged_in',
            'communityTitle' => 'Acme Community',
        ];

        $term = $this->makeTerm('billing', 'Billing', Taxonomies::TOPIC_TYPES->value);

        $this->assertSame('', SeoContent::forArchive($term, [$this->makeTopic()]));

        SeoMeta::forArchive($term, [$this->makeTopic()]);
        $this->assertSame('', SeoMeta::head());
    }

    // -----------------------------------------------------------------------
    // Workflow taxonomies are routes, not index entries.
    // -----------------------------------------------------------------------

    public function testStageArchivesAreKeptOutOfTheIndex(): void
    {
        $term = $this->makeTerm('in-progress', 'In Progress', Taxonomies::STAGES->value);

        SeoMeta::forArchive($term, [$this->makeTopic()]);
        $head = SeoMeta::head();

        // Nobody searches "in progress", and an archive per workflow state is a
        // thin, churning listing of topics that are already indexed on their own.
        $this->assertStringContainsString('<meta name="robots" content="noindex,follow" />', $head);
        $this->assertStringNotContainsString('application/ld+json', $head);

        // Still self-canonical: a noindex page pointing its canonical somewhere
        // else can carry the noindex across to the target.
        $this->assertStringContainsString(
            '<link rel="canonical" href="https://example.com/community/stage/in-progress" />',
            $head
        );
    }

    public function testSubjectArchivesStayIndexable(): void
    {
        $this->assertTrue(PortalTaxonomies::isIndexable('topic'));
        $this->assertTrue(PortalTaxonomies::isIndexable('tag'));
        $this->assertTrue(PortalTaxonomies::isIndexable('department'));
        $this->assertFalse(PortalTaxonomies::isIndexable('stage'));
    }

    // -----------------------------------------------------------------------
    // The links that make a cluster a cluster.
    // -----------------------------------------------------------------------

    public function testTopicLinksToTheArchivesItBelongsTo(): void
    {
        $topic = $this->makeTopic();
        $topic['terms'] = [
            'topic_types' => [
                'term_id'  => 3,
                'name'     => 'Billing',
                'slug'     => 'billing',
                'taxonomy' => Taxonomies::TOPIC_TYPES->value,
            ],
        ];

        $html = SeoContent::forTopic($topic);

        // Also the regression this fixes: a single-term taxonomy arrives as one
        // associative array, and iterating it walked scalar values that were all
        // skipped — so these terms rendered nowhere at all.
        $this->assertStringContainsString(
            '<a href="https://example.com/community/topic/billing">Billing</a>',
            $html
        );
    }

    public function testATermWithNoArchiveRendersAsPlainText(): void
    {
        $topic = $this->makeTopic();
        $topic['terms'] = [
            'unknown' => [
                'term_id'  => 9,
                'name'     => 'Some Term',
                'slug'     => 'some-term',
                'taxonomy' => 'a-taxonomy-with-no-archive',
            ],
        ];

        $html = SeoContent::forTopic($topic);

        // Named, but not linked — there is no archive to link it to.
        $this->assertStringContainsString('Some Term', $html);
        $this->assertStringNotContainsString('>Some Term</a>', $html);
    }

    public function testEveryTaxonomyTermNowLinksToItsArchive(): void
    {
        $topic = $this->makeTopic();
        $topic['terms'] = [
            'statuses' => [
                'term_id'  => 9,
                'name'     => 'Needs Approval',
                'slug'     => 'needs-approval',
                'taxonomy' => Taxonomies::STATUSES->value,
            ],
        ];

        $html = SeoContent::forTopic($topic);

        $this->assertStringContainsString(
            '<a href="https://example.com/community/status/needs-approval">Needs Approval</a>',
            $html
        );
    }

    public function testMultiTermTaxonomiesStillRender(): void
    {
        $topic = $this->makeTopic();
        $topic['terms'] = [
            'tags' => [
                ['term_id' => 4, 'name' => 'api', 'slug' => 'api', 'taxonomy' => Taxonomies::TAGS->value],
                ['term_id' => 5, 'name' => 'webhooks', 'slug' => 'webhooks', 'taxonomy' => Taxonomies::TAGS->value],
            ],
        ];

        $html = SeoContent::forTopic($topic);

        $this->assertStringContainsString('/community/tag/api', $html);
        $this->assertStringContainsString('/community/tag/webhooks', $html);
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
    private function makeTopic(int $id = 1): array
    {
        return [
            'ID'                => $id,
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
