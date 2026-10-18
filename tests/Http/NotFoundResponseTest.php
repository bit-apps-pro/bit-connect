<?php

namespace BitApps\BitConnect\Tests\Http;

use BitApps\BitConnect\Http\Controller\NotFoundController;
use BitApps\BitConnect\SSR\Seo\SeoMeta;
use BitApps\BitConnect\SSR\Seo\SeoPluginBridge;
use PHPUnit\Framework\TestCase;

/**
 * Pins the two halves of a portal "not found" that are easy to lose separately.
 *
 * The portal keeps rendering its own shell for a URL that does not exist, so
 * nothing in the markup signals the failure — the status header is the only
 * thing telling a crawler this is not a real page. Drop it and every typo and
 * every deleted topic becomes an indexable page under the community's name.
 *
 * @internal
 *
 * @coversNothing
 */
final class NotFoundResponseTest extends TestCase
{
    protected function setUp(): void
    {
        $GLOBALS['__wp_status_header'] = null;
        $GLOBALS['__wp_nocache_headers'] = false;
        $GLOBALS['__wp_actions'] = [];
        $GLOBALS['__wp_filters'] = [];

        (new \ReflectionClass(SeoMeta::class))->getProperty('meta')->setValue(null, null);
    }

    public function testItSendsARealNotFoundStatus(): void
    {
        NotFoundController::markResponseNotFound();

        $this->assertSame(404, $GLOBALS['__wp_status_header']);
    }

    public function testItKeepsTheNotFoundResponseOutOfCaches(): void
    {
        NotFoundController::markResponseNotFound();

        $this->assertTrue($GLOBALS['__wp_nocache_headers']);
    }

    public function testItMarksThePageNoindexForCrawlersThatReadMarkup(): void
    {
        NotFoundController::markResponseNotFound();

        $head = SeoMeta::head();

        $this->assertStringContainsString('name="robots"', $head);
        $this->assertStringContainsString('noindex', $head);
        // A canonical would name this missing URL as some other page.
        $this->assertStringNotContainsString('rel="canonical"', $head);
    }

    /**
     * "follow", not "nofollow": the page is worthless to index, but the portal
     * chrome around it still links back into the community and those links
     * should keep being crawled.
     */
    public function testItStillInvitesCrawlersToFollowTheLinksBackIntoThePortal(): void
    {
        NotFoundController::markResponseNotFound();

        $head = SeoMeta::head();

        $this->assertStringContainsString('noindex,follow', $head);
        $this->assertStringNotContainsString('nofollow', $head);
    }

    /**
     * Described as a route, so the site's SEO plugin is stood down rather than
     * printing the portal page's own `index` robots and canonical beside ours.
     */
    public function testTheSeoPluginStandsDownOnANotFoundPage(): void
    {
        NotFoundController::markResponseNotFound();

        $this->assertTrue(SeoPluginBridge::standsDown());
    }
}
