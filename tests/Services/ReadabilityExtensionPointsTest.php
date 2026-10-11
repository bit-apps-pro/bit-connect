<?php

namespace BitApps\BitConnect\Tests\Services;

use BitApps\BitConnect\Services\ExtensionPoints;
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
            $GLOBALS['__wp_filters']['bit_connect_portal_terms']
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

    public function testATermCanBeKeptFromTheReader(): void
    {
        $GLOBALS['__wp_filters']['bit_connect_portal_terms'] = static fn (array $terms): array => [$terms[1]];

        $this->assertSame(['b'], ExtensionPoints::portalTerms(['a', 'b'], 'bit-connect-boards'));
    }

    public function testAnAnswerThatAddsTermsIsDiscarded(): void
    {
        $GLOBALS['__wp_filters']['bit_connect_portal_terms'] = static fn (array $terms): array => [...$terms, 'c'];

        $this->assertSame(['a', 'b'], ExtensionPoints::portalTerms(['a', 'b'], 'bit-connect-boards'));
    }

    public function testATermsAnswerThatIsNotAnArrayIsDiscarded(): void
    {
        $GLOBALS['__wp_filters']['bit_connect_portal_terms'] = static fn () => false;

        $this->assertSame(['a'], ExtensionPoints::portalTerms(['a'], 'bit-connect-tags'));
    }
}
