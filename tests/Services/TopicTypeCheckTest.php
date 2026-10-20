<?php

namespace BitApps\BitConnect\Tests\Services;

use BitApps\BitConnect\Enum\Taxonomies;
use BitApps\BitConnect\Services\TopicCreationService;
use PHPUnit\Framework\TestCase;
use WP_Error;
use WP_Term;

/**
 * A topic type is a term that exists, not a number.
 *
 * WordPress files a post under an unknown term id as under nothing, so before
 * this check a stale form or a hand-made request saved a topic with no type at
 * all — past a form setting that makes the type required.
 *
 * @internal
 *
 * @coversNothing
 */
final class TopicTypeCheckTest extends TestCase
{
    protected function setUp(): void
    {
        $question = new WP_Term();
        $question->term_id = 110;
        $question->name = 'Question';
        $question->taxonomy = Taxonomies::TOPIC_TYPES->value;

        $tag = new WP_Term();
        $tag->term_id = 7;
        $tag->name = 'export';
        $tag->taxonomy = Taxonomies::TAGS->value;

        $GLOBALS['__wp_terms'] = [$question, $tag];
    }

    protected function tearDown(): void
    {
        $GLOBALS['__wp_terms'] = [];
    }

    public function testAnExistingTypeIsAccepted(): void
    {
        self::assertNull(TopicCreationService::unknownTopicType(110));
        self::assertNull(TopicCreationService::unknownTopicType('110'));
    }

    public function testNoTypeIsLeftToTheRequest(): void
    {
        self::assertNull(TopicCreationService::unknownTopicType(null));
        self::assertNull(TopicCreationService::unknownTopicType(''));
    }

    public function testAnUnknownIdIsRefusedOnItsField(): void
    {
        $error = TopicCreationService::unknownTopicType(1922116);

        self::assertInstanceOf(WP_Error::class, $error);
        self::assertSame(422, $error->get_error_data()['status']);
        self::assertSame('topic-types', $error->get_error_data()['field']);
    }

    public function testATermFromAnotherTaxonomyIsNotATopicType(): void
    {
        self::assertInstanceOf(WP_Error::class, TopicCreationService::unknownTopicType(7));
    }
}
