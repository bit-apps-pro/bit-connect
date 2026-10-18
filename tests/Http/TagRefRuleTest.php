<?php

namespace BitApps\BitConnect\Tests\Http;

use BitApps\BitConnect\Deps\BitApps\WPValidator\Validator;
use BitApps\BitConnect\Http\Requests\CreateTopicRequest;
use BitApps\BitConnect\Http\Requests\UpdateTopicRequest;
use BitApps\BitConnect\Services\TagResolverService;
use PHPUnit\Framework\TestCase;

/**
 * A topic's `tags` carry ids from the list and names the member typed, and
 * nothing else. Run through the real validator, like the cap.
 *
 * @internal
 *
 * @coversNothing
 */
final class TagRefRuleTest extends TestCase
{
    /**
     * @dataProvider requests
     */
    public function testIdsAndNamesPass(object $request): void
    {
        $this->assertTrue($this->passes($request, [3, '7', 'brand new', str_repeat('x', TagResolverService::MAX_NAME_LENGTH)]));
    }

    /**
     * @dataProvider requests
     */
    public function testZeroBlankAndOverlongAreRefusedWithTheMessage(object $request): void
    {
        $this->assertFalse($this->passes($request, [0]));
        $this->assertFalse($this->passes($request, ['   ']));
        $this->assertFalse($this->passes($request, [str_repeat('x', TagResolverService::MAX_NAME_LENGTH + 1)]));
        $this->assertFalse($this->passes($request, [['nested']]));

        $validator = $this->validate($request, [0]);
        $this->assertStringContainsString('from the list or a name', (string) ($validator->errors()['tags.0'][0] ?? implode(' ', array_map('implode', array_values($validator->errors())))));
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
     * @param array<int, mixed> $tags
     */
    private function passes(object $request, array $tags): bool
    {
        return !$this->validate($request, $tags)->fails();
    }

    /**
     * @param array<int, mixed> $tags
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
