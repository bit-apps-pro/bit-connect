<?php

namespace BitApps\BitConnect\Tests\Http;

use BitApps\BitConnect\Deps\BitApps\WPValidator\Validator;
use BitApps\BitConnect\Http\Requests\ToggleFollowRequest;
use BitApps\BitConnect\Http\Requests\UpdateNotificationSettingsRequest;
use PHPUnit\Framework\TestCase;

/**
 * Fields where zero is a real answer must accept it.
 *
 * wp-validator's `min` and `max` fail any value of 0, whatever the bound. With
 * `'min:0'`, following the whole forum (target_id 0) answered 400 on every click,
 * and a digest at midnight (hour 0) could not be saved.
 *
 * @internal
 *
 * @coversNothing
 */
final class ZeroBoundRulesTest extends TestCase
{
    public function testTheWholeForumCanBeFollowed(): void
    {
        $this->assertTrue($this->passes(new ToggleFollowRequest(), 'target_id', 0));
        $this->assertTrue($this->passes(new ToggleFollowRequest(), 'target_id', 12));
        $this->assertFalse($this->passes(new ToggleFollowRequest(), 'target_id', -1));
    }

    public function testADigestCanBeSentAtMidnight(): void
    {
        $request = new UpdateNotificationSettingsRequest();

        $this->assertTrue($this->passes($request, 'digestHour', 0));
        $this->assertTrue($this->passes($request, 'digestHour', 23));
        $this->assertFalse($this->passes($request, 'digestHour', 24));
        $this->assertFalse($this->passes($request, 'digestHour', -1));
    }

    public function testAnOutOfRangeHourKeepsItsOwnMessage(): void
    {
        $request = new UpdateNotificationSettingsRequest();
        $validator = (new Validator())->make(
            ['digestHour' => 24],
            ['digestHour' => $request->rules()['digestHour']],
            $request->messages()
        );

        $this->assertSame(['Pick an hour between 0 and 23.'], $validator->errors()['digestHour']);
    }

    /**
     * @param int|string $value
     */
    private function passes(object $request, string $field, $value): bool
    {
        $validator = (new Validator())->make(
            [$field => $value],
            [$field => $request->rules()[$field]]
        );

        return !$validator->fails();
    }
}
