<?php

namespace BitApps\BitConnect\Tests\Http;

use BitApps\BitConnect\Http\RestNoCache;
use PHPUnit\Framework\TestCase;
use WP_HTTP_Response;
use WP_REST_Request;

/**
 * Pins that no page cache keeps this plugin's REST answers.
 *
 * A cache that kept the admin's topic list served the old pin state after a
 * pin, because a pin changes an option and purges nothing.
 *
 * @internal
 *
 * @coversNothing
 */
final class RestNoCacheTest extends TestCase
{
    private const PREFIX = '/bit-connect/v1/';

    protected function tearDown(): void
    {
        unset($GLOBALS['__wp_serving_rest']);
    }

    /**
     * PortalPreload runs these routes inside a portal page, and core fires the
     * same filter there. Marking the page then kept every portal page out of
     * the page cache, for guests too.
     */
    public function testAPageThatRunsTheRoutesInProcessIsNotARestRequest(): void
    {
        $this->assertFalse(RestNoCache::servesRestRequest());

        $GLOBALS['__wp_serving_rest'] = true;

        $this->assertTrue(RestNoCache::servesRestRequest());
    }

    public function testItMarksARouteInTheNamespace(): void
    {
        $GLOBALS['__wp_serving_rest'] = true;

        $response = RestNoCache::mark(new WP_HTTP_Response(), $this->request('/bit-connect/v1/moderation/topics'), self::PREFIX);

        $headers = $response->get_headers();

        $this->assertStringContainsString('no-store', $headers['Cache-Control']);
        $this->assertSame('no-cache', $headers['X-LiteSpeed-Cache-Control']);
        $this->assertTrue(\defined('DONOTCACHEPAGE') && DONOTCACHEPAGE);
    }

    public function testItLeavesAnotherNamespaceAlone(): void
    {
        $response = RestNoCache::mark(new WP_HTTP_Response(), $this->request('/wp/v2/posts'), self::PREFIX);

        $this->assertSame([], $response->get_headers());
    }

    public function testANamespaceThatOnlySharesTheStartIsNotMatched(): void
    {
        $response = RestNoCache::mark(new WP_HTTP_Response(), $this->request('/bit-connect-pro/v1/held-topics'), self::PREFIX);

        $this->assertSame([], $response->get_headers());
    }

    public function testItPassesAnErrorThrough(): void
    {
        $this->assertSame('not a response', RestNoCache::mark('not a response', $this->request('/bit-connect/v1/topics'), self::PREFIX));
    }

    private function request(string $route): WP_REST_Request
    {
        return new WP_REST_Request([], [], [], $route);
    }
}
