<?php

namespace BitApps\BitConnect\Tests\Http;

use BitApps\BitConnect\Http\Requests\CreateTopicRequest;
use BitApps\BitConnect\Http\Requests\UpdateTopicRequest;
use PHPUnit\Framework\TestCase;

/**
 * What statuses this plugin's topic endpoints will write.
 *
 * 'publish' and nothing else. This replaced a test that asked whether the forum
 * was *allowed* to accept a private topic — a question with two gates and a
 * licence behind it. There is no such question now: topics visible only to
 * their author are the Bit Connect Pro add-on's feature, its endpoint included,
 * and this plugin holds no code that can produce one.
 *
 * That is what this test pins. A rule loosened back to a bare 'string' would
 * let 'private' through the door again and put the implementation back on the
 * free side, which is the WordPress.org guideline 5 problem the split exists to
 * avoid.
 *
 * @internal
 *
 * @coversNothing
 */
final class TopicStatusAllowlistTest extends TestCase
{
    public function testCreateAcceptsPublishOnly(): void
    {
        $this->assertSame(
            ['nullable', 'string', 'in:publish'],
            (new CreateTopicRequest())->rules()['post_status']
        );
    }

    public function testUpdateAcceptsPublishOnly(): void
    {
        $this->assertSame(
            ['nullable', 'string', 'in:publish'],
            (new UpdateTopicRequest())->rules()['post_status']
        );
    }

    /**
     * Neither rule set may name 'private' anywhere.
     *
     * Broader than the two assertions above on purpose: a rule added beside
     * these — a custom validator, a second status field — would not change the
     * arrays they compare, and this catches it.
     */
    public function testNeitherRequestNamesThePrivateStatus(): void
    {
        foreach ([new CreateTopicRequest(), new UpdateTopicRequest()] as $request) {
            $this->assertStringNotContainsStringIgnoringCase(
                'private',
                wp_json_encode($request->rules()),
                'A topic request rule names the private status.'
            );
        }
    }
}
