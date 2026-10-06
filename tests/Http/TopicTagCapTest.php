<?php

namespace BitApps\BitConnect\Tests\Http;

use BitApps\BitConnect\Deps\BitApps\WPValidator\Validator;
use BitApps\BitConnect\Http\Requests\CreateTopicRequest;
use BitApps\BitConnect\Http\Requests\UpdateTopicRequest;
use BitApps\BitConnect\Services\PostingLimits;
use PHPUnit\Framework\TestCase;

/**
 * How many tags a topic may carry.
 *
 * The portal's form caps the picker, but the form is one of the ways a topic is
 * created; the request is the one every way goes through. Run through the real
 * validator rather than compared as arrays, because `max` on an array counts
 * its items only by way of a helper this test would otherwise not exercise.
 *
 * @internal
 *
 * @coversNothing
 */
final class TopicTagCapTest extends TestCase
{
    /**
     * @dataProvider requests
     */
    public function testTheCeilingIsAccepted(object $request): void
    {
        $this->assertTrue($this->passes($request, range(1, PostingLimits::TOPIC_TAGS_CEILING)));
    }

    /**
     * @dataProvider requests
     */
    public function testOneOverIsRefusedWithItsOwnMessage(object $request): void
    {
        $validator = $this->validate($request, range(1, PostingLimits::TOPIC_TAGS_CEILING + 1));

        $this->assertTrue($validator->fails());
        $this->assertSame(
            [\sprintf('A topic may carry at most %d tags.', PostingLimits::TOPIC_TAGS_CEILING)],
            $validator->errors()['tags']
        );
    }

    /**
     * @dataProvider requests
     */
    public function testNoTagsIsStillFine(object $request): void
    {
        $this->assertTrue($this->passes($request, []));
    }

    /**
     * @dataProvider requests
     */
    public function testATagIdBelowOneIsRefused(object $request): void
    {
        $this->assertFalse($this->passes($request, [0]));
    }

    /**
     * @return array<string, array{0: object}>
     */
    public static function requests(): array
    {
        return [
            'create' => [new CreateTopicRequest()],
            'update' => [new UpdateTopicRequest()],
        ];
    }

    /**
     * @param array<int, int> $tags
     */
    private function passes(object $request, array $tags): bool
    {
        return !$this->validate($request, $tags)->fails();
    }

    /**
     * @param array<int, int> $tags
     */
    private function validate(object $request, array $tags): Validator
    {
        $rules = $request->rules();

        return (new Validator())->make(
            ['tags' => $tags],
            ['tags' => $rules['tags'], 'tags.*' => $rules['tags.*']],
            $request->messages()
        );
    }
}
