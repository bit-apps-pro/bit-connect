<?php

namespace BitApps\BitConnect\Tests\Views;

use BitApps\BitConnect\Config;
use BitApps\BitConnect\Views\ThemeBoot;
use PHPUnit\Framework\TestCase;

/**
 * The pre-paint theme script is one contract with the frontend's
 * `@shared/theme/theme-mode.ts`: the storage key, the `themeMode` field, the
 * legacy `isDarkTheme` fallback and the `dark` class. This pins the half the
 * server writes.
 *
 * @internal
 *
 * @coversNothing
 */
final class ThemeBootTest extends TestCase
{
    private const HANDLE = 'test-module-config';

    protected function setUp(): void
    {
        $GLOBALS['__wp_scripts'] = [];
    }

    public function testAttachesToTheGivenHandle(): void
    {
        ThemeBoot::attach(self::HANDLE);

        $this->assertCount(1, $GLOBALS['__wp_scripts'][self::HANDLE]['after']);
    }

    public function testReadsTheConfigAtomsStorageKey(): void
    {
        ThemeBoot::attach(self::HANDLE);
        $script = $this->script();

        // The key is the one value PHP contributes; it arrives JSON-encoded,
        // so the placeholder is gone and the slug is a quoted JS string.
        $this->assertStringContainsString('localStorage.getItem("' . Config::SLUG . '-config")', $script);
        $this->assertStringNotContainsString('%s', $script);
    }

    public function testAppliesTheStoredModeBeforeFirstPaint(): void
    {
        ThemeBoot::attach(self::HANDLE);
        $script = $this->script();

        $this->assertStringContainsString('v.themeMode==="dark"', $script);
        $this->assertStringContainsString('typeof v.isDarkTheme==="boolean"', $script);
        $this->assertStringContainsString('classList.toggle("dark",d)', $script);
        $this->assertStringContainsString('style.colorScheme=d?"dark":"light"', $script);
    }

    public function testIsAnIifeWithNoLeadingIndentation(): void
    {
        ThemeBoot::attach(self::HANDLE);
        $script = $this->script();

        // The JS is a nowdoc indented under its call; the closing marker's
        // indentation is stripped from every line, so the script starts at
        // column 0 and no line keeps the source indentation.
        $this->assertStringStartsWith('(function(){try{', $script);
        $this->assertStringEndsWith('}catch(e){}})();', $script);
        $this->assertDoesNotMatchRegularExpression('/^\s/m', $script);
    }

    private function script(): string
    {
        return implode("\n", $GLOBALS['__wp_scripts'][self::HANDLE]['after']);
    }
}
