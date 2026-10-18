<?php

namespace BitApps\BitConnect\Tests\Providers;

use BitApps\BitConnect\Enum\Taxonomies;
use BitApps\BitConnect\Providers\PostTypeProvider;
use PHPUnit\Framework\TestCase;
use ReflectionClass;

/**
 * A new forum gets one topic type, so its first topic can be posted: the topic
 * form asks for a type, and a forum with none shows an empty list.
 *
 * @internal
 *
 * @coversNothing
 */
final class FirstTopicTypeTest extends TestCase
{
    private const FLAG = 'bit_connect_first_topic_type_created';

    protected function setUp(): void
    {
        $GLOBALS['__wp_terms'] = [];
        $GLOBALS['__wp_term_counts'] = [];
        unset($GLOBALS['__wp_options'][self::FLAG]);
    }

    protected function tearDown(): void
    {
        $GLOBALS['__wp_terms'] = [];
        $GLOBALS['__wp_term_counts'] = [];
        unset($GLOBALS['__wp_options'][self::FLAG]);
    }

    public function testANewForumGetsOneTopicType(): void
    {
        $this->provider()->createFirstTopicType();

        $this->assertSame(['Question'], $this->topicTypeNames());
        $this->assertSame(1, get_option(self::FLAG));
    }

    public function testAForumWithTopicTypesGetsNoneAdded(): void
    {
        $GLOBALS['__wp_term_counts'][Taxonomies::TOPIC_TYPES->value] = 3;

        $this->provider()->createFirstTopicType();

        $this->assertSame([], $this->topicTypeNames());
        $this->assertSame(1, get_option(self::FLAG));
    }

    // Unlike the default stage and status, the type is not protected: an
    // admin who deletes it does not see it come back on the next request.
    public function testItIsMadeOnlyOnce(): void
    {
        $this->provider()->createFirstTopicType();
        $GLOBALS['__wp_terms'] = [];

        $this->provider()->createFirstTopicType();

        $this->assertSame([], $this->topicTypeNames());
    }

    private function provider(): PostTypeProvider
    {
        return (new ReflectionClass(PostTypeProvider::class))->newInstanceWithoutConstructor();
    }

    /**
     * @return string[]
     */
    private function topicTypeNames(): array
    {
        return array_values(array_map(
            static fn ($term): string => $term->name,
            array_filter($GLOBALS['__wp_terms'], static fn ($term): bool => $term->taxonomy === Taxonomies::TOPIC_TYPES->value)
        ));
    }
}
