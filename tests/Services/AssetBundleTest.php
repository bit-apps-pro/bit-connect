<?php

namespace BitApps\BitConnect\Tests\Services;

use BitApps\BitConnect\Config;
use BitApps\BitConnect\Services\ExtensionPoints;
use PHPUnit\Framework\TestCase;

/**
 * Pins down which build the rendered pages load.
 *
 * This plugin states where its own assets are and lets a listener answer with
 * a fuller build — the add-on ships no view layer, so its interface is this
 * plugin's screens loading the add-on's bundle. Nothing here asks what is
 * installed or whether anything is licensed; an unanswered filter is a working
 * forum on its own assets.
 *
 * What these cases guard is the failure that made the indirection worth having.
 * The three values used to be three independent questions, each answered by a
 * class_exists() on the add-on, so a build that existed but had never been run
 * handed back a URI with no code name — and the page asked for `main-.js`, got
 * a 404 and rendered blank. A listener that cannot supply the whole set must
 * lose the whole set.
 *
 * @internal
 *
 * @coversNothing
 */
final class AssetBundleTest extends TestCase
{
    private const OFFERED = [
        'codeName'       => 'alpha',
        'codeNameClient' => 'beta',
        'uri'            => 'https://example.com/wp-content/plugins/example-addon/assets',
    ];

    protected function setUp(): void
    {
        $GLOBALS['__wp_filters'] = [];

        ExtensionPoints::flush();
    }

    protected function tearDown(): void
    {
        $GLOBALS['__wp_filters'] = [];

        ExtensionPoints::flush();
    }

    public function testWithNobodyAnsweringTheBundleIsThisPluginsOwn(): void
    {
        $bundle = ExtensionPoints::assetBundle();

        $this->assertSame(Config::get('ROOT_URI') . '/' . Config::ASSETS_FOLDER, $bundle['uri']);
        $this->assertIsString($bundle['codeName']);
        $this->assertIsString($bundle['codeNameClient']);
    }

    public function testAListenerMayServeItsOwnBuildInstead(): void
    {
        $this->offer(self::OFFERED);

        $this->assertSame(self::OFFERED, ExtensionPoints::assetBundle());
    }

    public function testReturningTheBundleUntouchedIsHowAListenerDeclines(): void
    {
        $own = ExtensionPoints::assetBundle();

        ExtensionPoints::flush();
        $this->offer(static fn ($bundle) => $bundle);

        $this->assertSame($own, ExtensionPoints::assetBundle());
    }

    /**
     * @dataProvider unusableAnswers
     *
     * @param mixed $answer
     */
    public function testAnAnswerThatCannotBeUsedWholeIsRefused($answer): void
    {
        $own = ExtensionPoints::assetBundle();

        ExtensionPoints::flush();
        $this->offer($answer);

        $this->assertSame($own, ExtensionPoints::assetBundle());
    }

    /**
     * @return array<string, array{mixed}>
     */
    public static function unusableAnswers(): array
    {
        return [
            // The one that mattered: a build on disk with no code name file,
            // which used to reach the page as `main-.js`.
            'an empty code name'           => [['codeName' => '', 'codeNameClient' => 'beta', 'uri' => self::OFFERED['uri']]],
            'an empty client code name'    => [['codeName' => 'alpha', 'codeNameClient' => '', 'uri' => self::OFFERED['uri']]],
            'a missing uri'                => [['codeName' => 'alpha', 'codeNameClient' => 'beta']],
            'a missing client code name'   => [['codeName' => 'alpha', 'uri' => self::OFFERED['uri']]],
            'a value that is not a string' => [['codeName' => 'alpha', 'codeNameClient' => ['beta'], 'uri' => self::OFFERED['uri']]],
            'nothing array-shaped at all'  => ['https://example.com/assets'],
            'null'                         => [null],
        ];
    }

    public function testTheQuestionIsAskedOnceAndRememberedForTheRequest(): void
    {
        $asked = 0;

        $this->offer(static function ($bundle) use (&$asked) {
            ++$asked;

            return $bundle;
        });

        ExtensionPoints::assetBundle();
        ExtensionPoints::assetBundle();
        ExtensionPoints::assetBundle();

        $this->assertSame(1, $asked);
    }

    /**
     * @param mixed $answer
     */
    private function offer($answer): void
    {
        $GLOBALS['__wp_filters']['bit_connect_asset_bundle'] = $answer;
    }
}
