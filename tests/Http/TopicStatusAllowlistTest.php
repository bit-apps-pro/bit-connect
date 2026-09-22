<?php

namespace BitApps\BitConnect\Tests\Http;

use BitApps\BitConnect\Deps\BitApps\WPValidator\Validator;
use BitApps\BitConnect\Http\Requests\CreateTopicRequest;
use BitApps\BitConnect\Http\Requests\UpdateTopicRequest;
use BitApps\BitConnect\Http\Rules\InRule;
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
 * The rules are also run through the real validator, not only compared as
 * arrays: the previous version asserted `'in:publish'` literally, and
 * wp-validator has no `in` rule, so every topic create fataled while this test
 * stayed green.
 *
 * @internal
 *
 * @coversNothing
 */
final class TopicStatusAllowlistTest extends TestCase
{
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
     * @dataProvider requests
     */
    public function testAcceptsPublishOnly(object $request): void
    {
        $rule = $request->rules()['post_status'];

        $this->assertSame(['nullable', 'string'], \array_slice($rule, 0, 2));
        $this->assertInstanceOf(InRule::class, $rule[2]);
        $this->assertSame(['publish'], $rule[2]->allowed());
    }

    /**
     * @dataProvider requests
     */
    public function testTheValidatorAdmitsPublish(object $request): void
    {
        $validator = (new Validator())->make(
            ['post_status' => 'publish'],
            ['post_status' => $request->rules()['post_status']]
        );

        $this->assertFalse($validator->fails());
    }

    /**
     * @dataProvider requests
     */
    public function testTheValidatorRejectsPrivate(object $request): void
    {
        $validator = (new Validator())->make(
            ['post_status' => 'private'],
            ['post_status' => $request->rules()['post_status']]
        );

        $this->assertTrue($validator->fails());
        $this->assertArrayHasKey('post_status', $validator->errors());
    }

    /**
     * Neither allowlist may name 'private'.
     *
     * Read from the rule objects themselves: JSON-encoding the rules, as this
     * test used to, serialises an object rule as `{}` and would pass whatever
     * it allowed.
     */
    public function testNeitherRequestNamesThePrivateStatus(): void
    {
        foreach ([new CreateTopicRequest(), new UpdateTopicRequest()] as $request) {
            foreach ($request->rules() as $rules) {
                foreach ($rules as $rule) {
                    $text = $rule instanceof InRule ? implode(',', $rule->allowed()) : (string) $rule;

                    $this->assertStringNotContainsStringIgnoringCase(
                        'private',
                        $text,
                        'A topic request rule names the private status.'
                    );
                }
            }
        }
    }
}
