<?php

namespace BitApps\BitConnect\Tests\Services;

use BitApps\BitConnect\Services\TopicTaxonomies;
use PHPUnit\Framework\TestCase;

/**
 * Writing an added taxonomy's terms from a topic's data.
 *
 * @internal
 *
 * @coversNothing
 */
final class TopicTaxonomiesTest extends TestCase
{
    private const POST_ID = 42;

    protected function setUp(): void
    {
        $GLOBALS['__wp_taxonomies'] = ['shelves', 'aisles'];
        $GLOBALS['__wp_filters'] = [
            'bit_connect_topic_taxonomies' => [
                'shelves' => ['taxonomy' => 'shelves', 'singular' => 'Shelf'],
                'aisles'  => ['taxonomy' => 'aisles', 'singular' => 'Aisle', 'required' => true],
            ],
        ];
        $GLOBALS['__wp_post_terms'] = [self::POST_ID => ['shelves' => [7], 'aisles' => [9]]];
    }

    protected function tearDown(): void
    {
        $GLOBALS['__wp_taxonomies'] = [];
        $GLOBALS['__wp_filters'] = [];
        $GLOBALS['__wp_post_terms'] = [];
    }

    public function testAMissingParameterLeavesTheTermsAlone(): void
    {
        TopicTaxonomies::setTerms(self::POST_ID, []);

        $this->assertSame([7], $GLOBALS['__wp_post_terms'][self::POST_ID]['shelves']);
    }

    public function testAnEmptyParameterTakesTheTopicOutOfItsTerm(): void
    {
        TopicTaxonomies::setTerms(self::POST_ID, ['shelves' => null]);

        $this->assertSame([], $GLOBALS['__wp_post_terms'][self::POST_ID]['shelves']);
    }

    public function testAnEmptyParameterNeverEmptiesARequiredTaxonomy(): void
    {
        TopicTaxonomies::setTerms(self::POST_ID, ['aisles' => null]);

        $this->assertSame([9], $GLOBALS['__wp_post_terms'][self::POST_ID]['aisles']);
    }

    public function testATermIdMovesTheTopic(): void
    {
        TopicTaxonomies::setTerms(self::POST_ID, ['shelves' => 8]);

        $this->assertSame([8], $GLOBALS['__wp_post_terms'][self::POST_ID]['shelves']);
    }
}
