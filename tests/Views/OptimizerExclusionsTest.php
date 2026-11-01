<?php

namespace BitApps\BitConnect\Tests\Views;

use BitApps\BitConnect\Views\OptimizerExclusions;
use BitApps\BitConnect\Views\PrePaint;
use PHPUnit\Framework\TestCase;

/**
 * Pins how the portal's scripts are kept out of the JS and CSS optimisers.
 *
 * The portal starts in a fixed order — import map, config, pre-paint, bundle —
 * and an optimiser that delays, combines or moves any of them broke it. These
 * pin that each of the four carries the attributes the optimisers read, that
 * every other script on the page is left to them, and that nothing is marked
 * on a request that does not draw the portal.
 *
 * @internal
 *
 * @coversNothing
 */
final class OptimizerExclusionsTest extends TestCase
{
    protected function tearDown(): void
    {
        $this->setActive(null);
        $GLOBALS['__wp_did_actions'] = [];
    }

    /**
     * Whether the request draws the portal is settled on template_redirect. A
     * filter read before then must not decide it for the rest of the request.
     */
    public function testNothingIsMarkedBeforeThePortalIsKnown(): void
    {
        $tag = ['id' => 'wp-importmap', 'type' => 'importmap'];

        $this->assertSame($tag, OptimizerExclusions::markScript($tag));
        $this->assertSame(['a.js'], OptimizerExclusions::addPatterns(['a.js']));
        $this->assertNull($this->active());
    }

    public function testThePortalsFourScriptsAreMarked(): void
    {
        $this->setActive(true);

        foreach (['wp-importmap', 'bit-connect-sc-module-config-js-after', PrePaint::handle() . '-js-after', 'bit-connect-sc-MODULE-main-js-module'] as $id) {
            $marked = OptimizerExclusions::markScript(['id' => $id]);

            $this->assertSame('1', $marked['data-no-optimize'] ?? null, $id);
            $this->assertSame('1', $marked['data-no-defer'] ?? null, $id);
            $this->assertTrue($marked['nowprocket'] ?? false, $id);
            $this->assertSame($id, $marked['id']);
        }
    }

    /**
     * Cloudflare's Rocket Loader reads `data-cfasync` only before `src`.
     */
    public function testRocketLoadersAttributeComesFirst(): void
    {
        $this->setActive(true);

        $marked = OptimizerExclusions::markScript(['src' => 'https://example.com/main.js', 'id' => 'bit-connect-sc-MODULE-main-js-module']);

        $this->assertSame('data-cfasync', array_key_first($marked));
        $this->assertSame('false', $marked['data-cfasync']);
    }

    public function testOtherScriptsAreLeftToTheOptimisers(): void
    {
        $this->setActive(true);

        $tag = ['id' => 'jquery-core-js', 'src' => 'https://example.com/jquery.js'];

        $this->assertSame($tag, OptimizerExclusions::markScript($tag));
    }

    public function testNothingIsMarkedOnAPageWithoutThePortal(): void
    {
        $this->setActive(false);

        $tag = ['id' => 'bit-connect-sc-module-config-js-after'];

        $this->assertSame($tag, OptimizerExclusions::markScript($tag));
        $this->assertSame([], OptimizerExclusions::addHandles([]));
    }

    public function testTheExclusionListsNameTheBundleAndItsHandles(): void
    {
        $this->setActive(true);

        $patterns = OptimizerExclusions::addPatterns(['existing']);

        $this->assertSame('existing', $patterns[0]);
        $this->assertContains('wp-importmap', $patterns);
        $this->assertContains('bit-connect-sc-module-config', $patterns);
        $this->assertContains(PrePaint::handle(), OptimizerExclusions::addHandles([]));
        $this->assertContains('window["bit_connect_"]', OptimizerExclusions::addInlineMarkers([]));
    }

    /**
     * Autoptimize keeps its lists as one comma-separated string.
     */
    public function testAutoptimizesListStaysAString(): void
    {
        $this->setActive(true);

        $list = OptimizerExclusions::addPatternsToString('jquery.js, ');

        $this->assertIsString($list);
        $this->assertStringStartsWith('jquery.js, ', $list);
        $this->assertStringContainsString('wp-importmap', $list);
        $this->assertStringNotContainsString(', ,', $list);
    }

    private function setActive(?bool $active): void
    {
        (new \ReflectionClass(OptimizerExclusions::class))->getProperty('active')->setValue(null, $active);
    }

    private function active(): ?bool
    {
        return (new \ReflectionClass(OptimizerExclusions::class))->getProperty('active')->getValue();
    }
}
