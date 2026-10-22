<?php

namespace BitApps\BitConnect\Tests\Services;

use BitApps\BitConnect\Services\ExtensionPoints;
use BitApps\BitConnect\Services\TopicService;
use PHPUnit\Framework\TestCase;

/**
 * The hooks a plugin uses to keep topics and terms from a reader.
 *
 * Each can only narrow what this plugin would show. A listener that answers
 * with the wrong shape — or tries to add — leaves the plugin's own answer in
 * place, so a broken add-on cannot widen access.
 *
 * @internal
 *
 * @coversNothing
 */
final class ReadabilityExtensionPointsTest extends TestCase
{
    protected function tearDown(): void
    {
        unset(
            $GLOBALS['__wp_filters']['bit_connect_topic_query_args'],
            $GLOBALS['__wp_filters']['bit_connect_portal_terms'],
            $GLOBALS['__wp_filters']['bit_connect_held_back_topic_ids']
        );
    }

    public function testTheListQueryIsOfferedWithItsReaderAndContext(): void
    {
        $seen = [];
        $GLOBALS['__wp_filters']['bit_connect_topic_query_args'] = static function (array $args, int $userId, string $context) use (&$seen): array {
            $seen = [$userId, $context];
            $args['post__not_in'] = [5];

            return $args;
        };

        $args = ExtensionPoints::topicQueryArgs(['post_type' => 'bit-connect'], 4, 'list');

        $this->assertSame([4, 'list'], $seen);
        $this->assertSame([5], $args['post__not_in']);
    }

    public function testAListQueryAnswerThatIsNotAnArrayIsDiscarded(): void
    {
        $GLOBALS['__wp_filters']['bit_connect_topic_query_args'] = static fn () => null;

        $this->assertSame(['post_type' => 'bit-connect'], ExtensionPoints::topicQueryArgs(['post_type' => 'bit-connect'], 0, 'sitemap'));
    }

    public function testHeldBackTopicsBecomeAnSqlExclusion(): void
    {
        $GLOBALS['__wp_filters']['bit_connect_held_back_topic_ids'] = static fn (array $ids, int $userId): array => $userId === 0 ? [5, '7', 5] : [];

        $this->assertSame(' AND p.ID NOT IN (5,7)', TopicService::heldBackSql('p.ID', 0));
        $this->assertSame('', TopicService::heldBackSql('p.ID', 3), 'nothing held back from this reader');
    }

    /**
     * The ids are inlined into SQL, so nothing but positive integers survives.
     */
    public function testOnlyIdsAreTakenFromTheAnswer(): void
    {
        $GLOBALS['__wp_filters']['bit_connect_held_back_topic_ids'] = static fn (): array => ['1) OR (1=1', -4, 0, 9];

        $this->assertSame([1, 9], ExtensionPoints::heldBackTopicIds(0));
    }

    public function testATermCanBeKeptFromTheReader(): void
    {
        $GLOBALS['__wp_filters']['bit_connect_portal_terms'] = static fn (array $terms): array => [$terms[1]];

        $this->assertSame(['b'], ExtensionPoints::portalTerms(['a', 'b'], 'bit-connect-groups'));
    }

    public function testAnAnswerThatAddsTermsIsDiscarded(): void
    {
        $GLOBALS['__wp_filters']['bit_connect_portal_terms'] = static fn (array $terms): array => [...$terms, 'c'];

        $this->assertSame(['a', 'b'], ExtensionPoints::portalTerms(['a', 'b'], 'bit-connect-groups'));
    }

    public function testATermsAnswerThatIsNotAnArrayIsDiscarded(): void
    {
        $GLOBALS['__wp_filters']['bit_connect_portal_terms'] = static fn () => false;

        $this->assertSame(['a'], ExtensionPoints::portalTerms(['a'], 'bit-connect-tags'));
    }
}
