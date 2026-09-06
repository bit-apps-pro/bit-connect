<?php

namespace BitApps\BitConnect\Tests\Http;

use BitApps\BitConnect\Http\Controller\NotFoundController;
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

        $callbacks = $GLOBALS['__wp_actions']['wp_head'] ?? [];
        $this->assertCount(1, $callbacks);

        ob_start();
        $callbacks[0]();
        $head = (string) ob_get_clean();

        $this->assertStringContainsString('name="robots"', $head);
        $this->assertStringContainsString('noindex', $head);
    }

    /**
     * "follow", not "nofollow": the page is worthless to index, but the portal
     * chrome around it still links back into the community and those links
     * should keep being crawled.
     */
    public function testItStillInvitesCrawlersToFollowTheLinksBackIntoThePortal(): void
    {
        NotFoundController::markResponseNotFound();

        ob_start();
        $GLOBALS['__wp_actions']['wp_head'][0]();
        $head = (string) ob_get_clean();

        $this->assertStringContainsString('noindex,follow', $head);
        $this->assertStringNotContainsString('nofollow', $head);
    }
}
