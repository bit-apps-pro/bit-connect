<?php

namespace BitApps\BitConnect\Tests\Services;

use BitApps\BitConnect\Services\ExtensionPoints;
use PHPUnit\Framework\TestCase;

/**
 * Portal pages a plugin draws: a plugin can add a path, never take over one
 * the portal routes itself.
 *
 * @internal
 *
 * @coversNothing
 */
final class PortalPagesTest extends TestCase
{
    protected function tearDown(): void
    {
        unset($GLOBALS['__wp_filters']['bit_connect_portal_pages']);
    }

    public function testWithNobodyListeningThereAreNone(): void
    {
        $this->assertSame([], ExtensionPoints::portalPages());
    }

    public function testAPluginAddsAPageWithItsTitle(): void
    {
        $GLOBALS['__wp_filters']['bit_connect_portal_pages'] = static fn (array $pages): array => ['boards' => 'Boards'] + $pages;

        $this->assertSame(['boards' => 'Boards'], ExtensionPoints::portalPages());
    }

    public function testAPathThePortalAlreadyUsesIsRefused(): void
    {
        $GLOBALS['__wp_filters']['bit_connect_portal_pages'] = static fn (): array => [
            'roadmap'       => 'Mine now',
            'notifications' => 'Mine too',
            'login'         => 'And this',
            'tag'           => 'An archive segment',
        ];

        $this->assertSame([], ExtensionPoints::portalPages());
    }

    public function testOnlyAPlainLowerCaseSegmentIsAccepted(): void
    {
        $GLOBALS['__wp_filters']['bit_connect_portal_pages'] = static fn (): array => [
            'two/segments' => 'x',
            'Upper'        => 'x',
            '../escape'    => 'x',
            'ok-page'      => '<b>Title</b>',
        ];

        $this->assertSame(['ok-page' => 'Title'], ExtensionPoints::portalPages());
    }
}
