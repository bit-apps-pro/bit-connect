<?php

namespace BitApps\BitConnect\Tests\Services;

use BitApps\BitConnect\Services\TermMetaKeys;
use PHPUnit\Framework\TestCase;
use WP_Term;

/**
 * The term meta this plugin writes moved from bare keys (`color`, `order`,
 * `is_default` …) to `bit_connect_` keys. Existing sites carry their values
 * across once; these tests pin the once, the carry, and the not-overwriting.
 *
 * @internal
 *
 * @coversNothing
 */
final class TermMetaKeysTest extends TestCase
{
    protected function setUp(): void
    {
        $GLOBALS['__wp_options'] = [];
        $GLOBALS['__wp_terms'] = [];
        $GLOBALS['__wp_term_meta'] = [];
    }

    public function testMovesEveryBareKeyUnderItsPrefixedName(): void
    {
        $this->seedTerm(7, 'bit-connect-statuses');
        $GLOBALS['__wp_term_meta'][7] = [
            'color'         => '#ff0000',
            'icon_url'      => 'https://example.com/i.png',
            'icon_id'       => 12,
            'icon_dark_url' => 'https://example.com/d.png',
            'icon_dark_id'  => 13,
            'is_default'    => '1',
            'order'         => 2,
        ];

        $moved = TermMetaKeys::migrate();

        $this->assertSame(7, $moved);
        $this->assertSame(
            [
                'bit_connect_color'         => '#ff0000',
                'bit_connect_icon_url'      => 'https://example.com/i.png',
                'bit_connect_icon_id'       => 12,
                'bit_connect_icon_dark_url' => 'https://example.com/d.png',
                'bit_connect_icon_dark_id'  => 13,
                'bit_connect_is_default'    => '1',
                'bit_connect_order'         => 2,
            ],
            $GLOBALS['__wp_term_meta'][7]
        );
    }

    public function testKeepsAValueAlreadySavedUnderTheNewKey(): void
    {
        $this->seedTerm(3, 'bit-connect-topic-types');
        $GLOBALS['__wp_term_meta'][3] = [
            'color'             => '#000000',
            'bit_connect_color' => '#ffffff',
        ];

        TermMetaKeys::migrate();

        $this->assertSame(['bit_connect_color' => '#ffffff'], $GLOBALS['__wp_term_meta'][3]);
    }

    public function testLeavesTermsOfOtherTaxonomiesAlone(): void
    {
        $this->seedTerm(9, 'category');
        $GLOBALS['__wp_term_meta'][9] = ['color' => 'not ours'];

        TermMetaKeys::migrate();

        $this->assertSame(['color' => 'not ours'], $GLOBALS['__wp_term_meta'][9]);
    }

    public function testRunsOnce(): void
    {
        $this->seedTerm(5, 'bit-connect-stages');
        $GLOBALS['__wp_term_meta'][5] = ['order' => 1];

        TermMetaKeys::migrate();

        // A bare key written after the migration is a foreign one now.
        $GLOBALS['__wp_term_meta'][5]['order'] = 4;

        $this->assertSame(0, TermMetaKeys::migrate());
        $this->assertSame(1, $GLOBALS['__wp_term_meta'][5]['bit_connect_order']);
        $this->assertSame(4, $GLOBALS['__wp_term_meta'][5]['order']);
    }

    private function seedTerm(int $id, string $taxonomy): void
    {
        $term = new WP_Term();
        $term->term_id = $id;
        $term->taxonomy = $taxonomy;
        $term->name = 'Term ' . $id;
        $term->slug = 'term-' . $id;

        $GLOBALS['__wp_terms'][] = $term;
    }
}
