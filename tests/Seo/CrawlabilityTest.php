<?php

namespace BitApps\BitConnect\Tests\Seo;

use BitApps\BitConnect\Config;
use BitApps\BitConnect\Services\PortalLocation;
use BitApps\BitConnect\SSR\Seo\SeoContent;
use BitApps\BitConnect\SSR\Seo\SeoMeta;
use PHPUnit\Framework\TestCase;

/**
 * Proves the portal is readable by clients that never execute JavaScript.
 *
 * The portal is a React SPA, so everything a crawler can see has to be in the
 * server response. Each group below asserts what one class of client actually
 * consumes:
 *
 * - Search engines (Googlebot, Bingbot): body content, headings, crawlable
 *   <a href> links, canonical.
 * - AI / LLM crawlers (GPTBot, ClaudeBot, PerplexityBot, CCBot): body text —
 *   none of them run JavaScript, so the topic content has to be in the HTML.
 * - Link preview bots (Slack, Discord, Facebook, X, iMessage): og:* and
 *   twitter:* only. They never read the body.
 * - Rich results: JSON-LD structured data.
 *
 * @internal
 *
 * @coversNothing
 */
final class CrawlabilityTest extends TestCase
{
    private const PORTAL_PAGE_ID = 7;

    /** @var array<string, mixed> */
    private array $topic;

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

        $this->topic = $this->makeTopic();

        $this->resetMeta();

        PortalLocation::resetCache();
    }

    protected function tearDown(): void
    {
        $GLOBALS['__wp_posts'] = [];

        PortalLocation::resetCache();
    }

    /**
     * Put the portal at the site root: the flag plus the front-page binding it
     * needs to actually take effect.
     */
    private function serveAtSiteRoot(): void
    {
        update_option(Config::withPrefix(PortalLocation::ROOT_OPTION), 1);
        update_option('show_on_front', 'page');
        update_option('page_on_front', self::PORTAL_PAGE_ID);

        PortalLocation::resetCache();
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

    // -----------------------------------------------------------------------
    // Search engines — Googlebot, Bingbot, DuckDuckBot, Yandex
    // -----------------------------------------------------------------------

    public function testTopicListExposesTitlesAndCrawlableLinks(): void
    {
        $html = SeoContent::forTopics([$this->topic, $this->makeTopic(2, 'Second topic', 'second-topic')]);

        $this->assertStringContainsString('How do I reset my password', $html);
        $this->assertStringContainsString('Second topic', $html);

        // A crawler follows <a href>; a router-only click handler is invisible to it.
        $this->assertStringContainsString('href="https://example.com/community/how-do-i"', $html);
        $this->assertStringContainsString('href="https://example.com/community/second-topic"', $html);
    }

    public function testTopicListUsesADocumentOutlineCrawlersCanRead(): void
    {
        $html = SeoContent::forTopics([$this->topic]);

        $this->assertMatchesRegularExpression('#<h1[^>]*>Acme Community</h1>#', $html);
        $this->assertMatchesRegularExpression('#<h2[^>]*>.*How do I reset my password.*</h2>#s', $html);
    }

    public function testTopicDetailExposesFullBodyText(): void
    {
        $html = SeoContent::forTopic($this->topic);

        $this->assertStringContainsString('You can reset it from the account page.', $html);
        $this->assertMatchesRegularExpression('#<h1[^>]*>How do I reset my password</h1>#', $html);
    }

    public function testTopicDetailExposesRepliesSoDiscussionIsIndexable(): void
    {
        $html = SeoContent::forTopic($this->topic);

        $this->assertStringContainsString('Try the forgot password link.', $html);
        $this->assertStringContainsString('Dana', $html);
    }

    public function testCanonicalPointsAtThePortalRouteNotThePostTypeRewrite(): void
    {
        SeoMeta::forTopic($this->topic);
        $head = SeoMeta::head();

        $this->assertStringContainsString(
            '<link rel="canonical" href="https://example.com/community/how-do-i" />',
            $head
        );
        // /bit-connect/{slug} is the CPT's own rewrite and must not be the canonical.
        $this->assertStringNotContainsString('/bit-connect/how-do-i', $head);
    }

    public function testCanonicalDropsTheSlugWhenThePortalIsServedAtTheSiteRoot(): void
    {
        $this->serveAtSiteRoot();

        SeoMeta::forTopic($this->topic);
        $head = SeoMeta::head();

        $this->assertStringContainsString(
            '<link rel="canonical" href="https://example.com/how-do-i" />',
            $head
        );
        $this->assertStringNotContainsString('/community/how-do-i', $head);
    }

    /**
     * Root mode is only real once the portal page is the front page. Switched on
     * without that, canonicals have to stay on the slug — root URLs nothing
     * serves would send crawlers into the CPT redirect's 404 bounce.
     */
    public function testCanonicalStaysOnTheSlugWhenRootModeIsNotFrontPageBound(): void
    {
        $this->serveAtSiteRoot();
        update_option('page_on_front', 0);
        PortalLocation::resetCache();

        SeoMeta::forTopic($this->topic);

        $this->assertStringContainsString(
            '<link rel="canonical" href="https://example.com/community/how-do-i" />',
            SeoMeta::head()
        );
    }

    // -----------------------------------------------------------------------
    // AI / LLM crawlers — GPTBot, ClaudeBot, PerplexityBot, CCBot, Google-Extended
    // None execute JavaScript, so body text must be in the response.
    // -----------------------------------------------------------------------

    public function testContentIsPresentWithoutRunningJavaScript(): void
    {
        $listing = SeoContent::forTopics([$this->topic]);
        $detail = SeoContent::forTopic($this->topic);

        // The signal that matters: the readable text survives tag stripping,
        // which is roughly what a text-extracting crawler keeps.
        $this->assertStringContainsString('How do I reset my password', wp_strip_all_tags($listing));
        $this->assertStringContainsString('You can reset it from the account page.', wp_strip_all_tags($detail));
    }

    public function testTopicListIsNotAnEmptySkeleton(): void
    {
        $html = SeoContent::forTopics([$this->topic]);
        $text = trim(preg_replace('/\s+/', ' ', wp_strip_all_tags($html)));

        // The old build-time prerender emitted layout markup with no words in it.
        $this->assertGreaterThan(40, strlen($text), 'Server HTML carried no readable text.');
    }

    // -----------------------------------------------------------------------
    // Link preview bots — Slack, Discord, Facebook, X, iMessage
    // These read the <head> only and never touch the body.
    // -----------------------------------------------------------------------

    public function testTopicPreviewCardUsesTheTopicNotThePortalPage(): void
    {
        SeoMeta::forTopic($this->topic);
        $head = SeoMeta::head();

        $this->assertStringContainsString('<meta property="og:title" content="How do I reset my password" />', $head);
        $this->assertStringContainsString('<meta property="og:type" content="article" />', $head);
        $this->assertStringContainsString('<meta property="og:url" content="https://example.com/community/how-do-i" />', $head);
        $this->assertStringContainsString('og:description', $head);
    }

    public function testTopicWithoutAThumbnailFallsBackToTheCommunityImage(): void
    {
        SeoMeta::forTopic($this->topic);
        $head = SeoMeta::head();

        // A topic with no featured image used to preview as a bare `summary`
        // card with no image at all. The community's own logo is a far better
        // answer than nothing, and keeps every topic on the large card.
        $this->assertStringContainsString('<meta property="og:image" content="https://example.com/logo.png" />', $head);
        $this->assertStringContainsString('<meta name="twitter:card" content="summary_large_image" />', $head);
    }

    public function testTwitterCardIsSummaryWhenNoImageExistsAnywhere(): void
    {
        $GLOBALS['__wp_options'][Config::withPrefix('general_settings')] = [
            'portalAccess'   => 'everyone',
            'communityTitle' => 'Acme Community',
        ];
        $GLOBALS['__wp_site_icon'] = '';

        SeoMeta::forTopic($this->topic);
        $head = SeoMeta::head();

        $this->assertStringContainsString('<meta name="twitter:card" content="summary" />', $head);
        $this->assertStringNotContainsString('og:image', $head);
    }

    public function testCommunityImageFallsBackToTheSiteIconWhenNoLogoIsConfigured(): void
    {
        $GLOBALS['__wp_options'][Config::withPrefix('general_settings')] = [
            'portalAccess'   => 'everyone',
            'communityTitle' => 'Acme Community',
        ];
        $GLOBALS['__wp_site_icon'] = 'https://example.com/icon.png';

        SeoMeta::forTopic($this->topic);

        $this->assertStringContainsString(
            '<meta property="og:image" content="https://example.com/icon.png" />',
            SeoMeta::head()
        );
    }

    public function testTwitterCardUpgradesToLargeImageWhenTheTopicHasAThumbnail(): void
    {
        $GLOBALS['__wp_thumbnails'] = [1 => 'https://example.com/hero.jpg'];

        SeoMeta::forTopic($this->topic);
        $head = SeoMeta::head();

        $this->assertStringContainsString('<meta name="twitter:card" content="summary_large_image" />', $head);
        $this->assertStringContainsString('<meta property="og:image" content="https://example.com/hero.jpg" />', $head);
    }

    public function testListRouteAdvertisesTheCommunityAsAWebsite(): void
    {
        SeoMeta::forTopics([$this->topic]);
        $head = SeoMeta::head();

        $this->assertStringContainsString('<meta property="og:type" content="website" />', $head);
        $this->assertStringContainsString('<meta property="og:title" content="Acme Community" />', $head);
    }

    // -----------------------------------------------------------------------
    // Rich results — structured data
    // -----------------------------------------------------------------------

    public function testTopicEmitsDiscussionForumPostingStructuredData(): void
    {
        SeoMeta::forTopic($this->topic);
        $data = $this->extractJsonLd(SeoMeta::head());

        $this->assertSame('https://schema.org', $data['@context']);
        $this->assertSame('DiscussionForumPosting', $data['@type']);
        $this->assertSame('How do I reset my password', $data['headline']);
        $this->assertSame('Casey', $data['author']['name']);
        $this->assertSame('2026-03-04T10:00:00+00:00', $data['datePublished']);
        $this->assertSame(1, $data['interactionStatistic']['userInteractionCount']);
        $this->assertSame('Try the forgot password link.', $data['comment'][0]['text']);
    }

    public function testTopicListEmitsCollectionPageStructuredData(): void
    {
        SeoMeta::forTopics([$this->topic, $this->makeTopic(2, 'Second topic', 'second-topic')]);
        $data = $this->extractJsonLd(SeoMeta::head());

        $this->assertSame('CollectionPage', $data['@type']);
        $this->assertSame('ItemList', $data['mainEntity']['@type']);
        $this->assertCount(2, $data['mainEntity']['itemListElement']);
        $this->assertSame(
            'https://example.com/community/how-do-i',
            $data['mainEntity']['itemListElement'][0]['url']
        );
    }

    public function testStructuredDataIsValidJson(): void
    {
        SeoMeta::forTopic($this->topic);

        preg_match('#<script type="application/ld\+json">(.*?)</script>#s', SeoMeta::head(), $matches);

        $this->assertNotEmpty($matches, 'No JSON-LD block was emitted.');
        $this->assertNotNull(json_decode($matches[1], true), 'JSON-LD was not parseable: ' . json_last_error_msg());
    }

    // -----------------------------------------------------------------------
    // What must NOT be crawlable
    // -----------------------------------------------------------------------

    public function testRestrictedPortalExposesNothingToCrawlers(): void
    {
        $GLOBALS['__wp_options'][Config::withPrefix('general_settings')]['portalAccess'] = 'logged_in';

        $this->assertSame('', SeoContent::forTopics([$this->topic]));
        $this->assertSame('', SeoContent::forTopic($this->topic));

        SeoMeta::forTopic($this->topic);
        $this->assertSame('', SeoMeta::head());
    }

    public function testDraftTopicIsNeverRendered(): void
    {
        // get_page_by_path() does not filter post status, so a draft can reach here.
        $draft = $this->makeTopic();
        $draft['post_status'] = 'draft';

        $this->assertSame('', SeoContent::forTopic($draft));

        SeoMeta::forTopic($draft);
        $this->assertSame('', SeoMeta::head());
    }

    public function testPrivateTopicIsExcludedFromTheCrawlableList(): void
    {
        $private = $this->makeTopic(2, 'Internal planning', 'internal-planning');
        $private['post_status'] = 'private';

        $html = SeoContent::forTopics([$this->topic, $private]);

        $this->assertStringContainsString('How do I reset my password', $html);
        $this->assertStringNotContainsString('Internal planning', $html);
    }

    public function testPrivateTopicIsExcludedFromStructuredData(): void
    {
        $private = $this->makeTopic(2, 'Internal planning', 'internal-planning');
        $private['post_status'] = 'private';

        SeoMeta::forTopics([$this->topic, $private]);
        $data = $this->extractJsonLd(SeoMeta::head());

        $this->assertCount(1, $data['mainEntity']['itemListElement']);
        $this->assertStringNotContainsString('Internal planning', SeoMeta::head());
    }

    public function testTopicContentCannotInjectScriptIntoTheCrawledPage(): void
    {
        $hostile = $this->makeTopic();
        $hostile['post_content'] = 'Hello <script>alert(1)</script> there <img src=x onerror="alert(2)">';

        $html = SeoContent::forTopic($hostile);

        $this->assertStringNotContainsString('<script>', $html);
        $this->assertStringNotContainsString('onerror', $html);
        $this->assertStringContainsString('Hello', $html);
    }

    public function testTopicTitleIsEscapedInBothBodyAndHead(): void
    {
        $hostile = $this->makeTopic();
        $hostile['post_title'] = 'Bad "quote" <script>';

        $body = SeoContent::forTopic($hostile);
        SeoMeta::forTopic($hostile);
        $head = SeoMeta::head();

        $this->assertStringNotContainsString('<script>', $body);
        $this->assertStringContainsString('&lt;script&gt;', $body);

        // The head contains our own toggle <script>, so assert on the payload:
        // the hostile title must never appear with its tags intact.
        $this->assertStringNotContainsString('Bad "quote" <script>', $head);
        $this->assertStringContainsString('&lt;script&gt;', $head);
        // Inside the JSON-LD block, < and > are hex-encoded so the payload
        // cannot close the script element.
        $this->assertStringNotContainsString('"headline":"Bad \"quote\" <script>"', $head);
    }

    // -----------------------------------------------------------------------
    // Human view: spinner via JS-gated CSS, content stays for non-JS clients
    // -----------------------------------------------------------------------

    public function testContentIsVisibleByDefaultAndHiddenOnlyWithJavaScript(): void
    {
        $css = SeoContent::criticalCss();

        // Default (no JS, i.e. crawlers): spinner hidden, content shown.
        $this->assertStringContainsString('.bc-ssr-loading{display:none}', $css);

        // With JS (humans): the bc-js class flips to spinner-only.
        $this->assertStringContainsString('.bc-js .bc-ssr-loading{display:block}', $css);
        $this->assertStringContainsString('.bc-js .bc-ssr{display:none}', $css);
    }

    public function testHeadTogglesTheHumanViewBeforeFirstPaint(): void
    {
        SeoMeta::forTopic($this->topic);
        $head = SeoMeta::head();

        $this->assertStringContainsString('classList.add("bc-js")', $head);

        // Safety valve: a bundle that never mounts re-reveals the content.
        $this->assertStringContainsString('classList.remove("bc-js")', $head);
    }

    public function testContentMarkupItselfDoesNotDependOnJavaScript(): void
    {
        // The hiding is head-CSS + head-script only; the body markup must stay
        // plain so a client that ignores both still reads the content.
        $html = SeoContent::forTopic($this->topic);

        $this->assertStringNotContainsString('<script', $html);
        $this->assertStringNotContainsString('display:none', $html);
    }

    // -----------------------------------------------------------------------
    // Coexistence with dedicated SEO plugins
    // -----------------------------------------------------------------------

    public function testSocialTagsAreSuppressedWhenAnSeoPluginOwnsThem(): void
    {
        $GLOBALS['__wp_filters']['bit_connect_seo_social_tags'] = false;

        SeoMeta::forTopic($this->topic);
        $head = SeoMeta::head();

        $this->assertStringNotContainsString('og:title', $head);
        $this->assertStringNotContainsString('rel="canonical"', $head);

        // JSON-LD is additive and still emitted — nothing competes with it.
        $this->assertStringContainsString('DiscussionForumPosting', $head);
    }

    // -----------------------------------------------------------------------
    // Helpers
    // -----------------------------------------------------------------------

    /**
     * @return array<string, mixed>
     */
    // -----------------------------------------------------------------------
    // Deeper pages of the list. The server list is capped at a screenful, so
    // these are the crawl path to everything older — not index entries.
    // -----------------------------------------------------------------------

    public function testFirstPageIsTheIndexableOne(): void
    {
        SeoMeta::forTopics([$this->topic], 1);
        $head = SeoMeta::head();

        $this->assertStringNotContainsString('noindex', $head);
        $this->assertStringContainsString(
            '<link rel="canonical" href="https://example.com/community" />',
            $head
        );
    }

    public function testDeeperPagesAreCrawledButNotIndexed(): void
    {
        SeoMeta::forTopics([$this->topic], 3);
        $head = SeoMeta::head();

        // `follow` is the whole point: the page exists so the topics it links to
        // are reachable, not so the listing itself ranks.
        $this->assertStringContainsString('<meta name="robots" content="noindex,follow" />', $head);
    }

    public function testDeeperPagesAreSelfCanonicalNotPointedAtPageOne(): void
    {
        SeoMeta::forTopics([$this->topic], 3);

        // Pointing a noindex page's canonical at page 1 is the pairing that can
        // carry the noindex across to page 1.
        $this->assertStringContainsString(
            '<link rel="canonical" href="https://example.com/community/page/3" />',
            SeoMeta::head()
        );
    }

    public function testDeeperPageTitleNamesItsPage(): void
    {
        SeoMeta::forTopics([$this->topic], 2);

        $this->assertSame(
            ['title' => 'Acme Community — page 2'],
            SeoMeta::filterTitle(['title' => 'Community — Acme', 'page' => 'Page 2'])
        );
    }

    public function testWordPressOwnPageSuffixIsDropped(): void
    {
        SeoMeta::forTopics([$this->topic], 1);

        // The main query on a claimed route is the portal *page*, so core's
        // "Page N" part describes the wrong thing entirely.
        $parts = SeoMeta::filterTitle(['title' => 'x', 'page' => 'Page 7']);

        $this->assertArrayNotHasKey('page', $parts);
    }

    public function testListLinksToTheNextPageWhenThereIsOne(): void
    {
        $html = SeoContent::forTopics([$this->topic], 1, 3);

        $this->assertStringContainsString('rel="next"', $html);
        $this->assertStringContainsString('https://example.com/community/page/2', $html);
        $this->assertStringNotContainsString('rel="prev"', $html);
    }

    public function testMiddlePageLinksBothWays(): void
    {
        $html = SeoContent::forTopics([$this->topic], 2, 3);

        $this->assertStringContainsString('rel="prev"', $html);
        $this->assertStringContainsString('rel="next"', $html);
        // Back to page 1 is the bare portal URL, not `/page/1`.
        $this->assertStringContainsString('href="https://example.com/community" rel="prev"', $html);
    }

    public function testLastPageHasNoNextLink(): void
    {
        $html = SeoContent::forTopics([$this->topic], 3, 3);

        $this->assertStringContainsString('rel="prev"', $html);
        $this->assertStringNotContainsString('rel="next"', $html);
    }

    public function testASinglePageListHasNoTrailAtAll(): void
    {
        $html = SeoContent::forTopics([$this->topic], 1, 1);

        $this->assertStringNotContainsString('rel="next"', $html);
        $this->assertStringNotContainsString('rel="prev"', $html);
    }

    public function testTopicEmitsBreadcrumbStructuredData(): void
    {
        SeoMeta::forTopic($this->topic);
        $head = SeoMeta::head();

        // Without a trail the result shows a bare URL rather than naming the
        // community the discussion belongs to.
        $this->assertStringContainsString('"@type":"BreadcrumbList"', $head);
        $this->assertStringContainsString('"name":"Acme Community"', $head);
        $this->assertStringContainsString('"item":"https://example.com/community"', $head);
        $this->assertStringContainsString('"item":"https://example.com/community/how-do-i"', $head);
    }

    public function testEachStructuredDataDocumentIsSeparatelyValidJson(): void
    {
        SeoMeta::forTopic($this->topic);

        preg_match_all(
            '#<script type="application/ld\+json">(.*?)</script>#s',
            SeoMeta::head(),
            $matches
        );

        $this->assertCount(2, $matches[1], 'Expected a discussion and a breadcrumb document.');

        foreach ($matches[1] as $json) {
            $this->assertIsArray(json_decode($json, true), 'Structured data was not valid JSON.');
        }
    }

    // -----------------------------------------------------------------------
    // Member profiles. Thin, near-identical between members and assembled
    // client-side — indexing them competes with the topics themselves.
    // -----------------------------------------------------------------------

    public function testProfileRouteIsKeptOutOfTheIndex(): void
    {
        SeoMeta::forProfile('Casey');
        $head = SeoMeta::head();

        $this->assertStringContainsString('<meta name="robots" content="noindex,follow" />', $head);

        // `follow` is the point: the member's own topics stay discoverable from
        // here even though this page is not itself indexed.
        $this->assertStringNotContainsString('noindex,nofollow', $head);
    }

    public function testProfileRouteDoesNotClaimThePortalsCanonical(): void
    {
        SeoMeta::forProfile('Casey');

        // Previously the profile inherited the portal page's canonical, making
        // every member URL a duplicate of the community landing page.
        $this->assertStringNotContainsString('rel="canonical"', SeoMeta::head());
    }

    public function testProfileTitleNamesTheMemberAndTheCommunity(): void
    {
        SeoMeta::forProfile('Casey');

        $this->assertSame(
            ['title' => 'Casey — Acme Community'],
            SeoMeta::filterTitle(['title' => 'Community — Acme'])
        );
    }

    public function testProfileWithoutAResolvableMemberStillCarriesATitle(): void
    {
        SeoMeta::forProfile('');

        $parts = SeoMeta::filterTitle(['title' => 'Community — Acme']);

        $this->assertSame('Member profile — Acme Community', $parts['title']);
    }

    private function makeTopic(
        int $id = 1,
        string $title = 'How do I reset my password',
        string $slug = 'how-do-i'
    ): array {
        return [
            'ID'             => $id,
            'post_title'     => $title,
            'post_name'      => $slug,
            'post_status'    => 'publish',
            'post_content'   => 'You can reset it from the account page.',
            'post_excerpt'   => '',
            'post_date'      => '2026-03-04 10:00:00',
            'post_date_gmt'  => '2026-03-04 10:00:00',
            'post_modified_gmt' => '2026-03-05 09:00:00',
            'author_name'    => 'Casey',
            'comments_count' => 1,
            'terms'          => [
                'topic_types' => ['name' => 'Question'],
            ],
            'comments' => [
                [
                    'comment_author'   => 'Dana',
                    'comment_content'  => 'Try the forgot password link.',
                    'comment_date_gmt' => '2026-03-04 12:00:00',
                ],
            ],
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function extractJsonLd(string $head): array
    {
        preg_match('#<script type="application/ld\+json">(.*?)</script>#s', $head, $matches);

        $this->assertNotEmpty($matches, 'No JSON-LD block was emitted.');

        return json_decode($matches[1], true);
    }

    /**
     * SeoMeta holds the resolved route in a static, so it has to be cleared
     * between tests or a previous route's head leaks into the next assertion.
     */
    private function resetMeta(): void
    {
        $reflection = new \ReflectionClass(SeoMeta::class);
        $reflection->getProperty('meta')->setValue(null, null);
    }
}
