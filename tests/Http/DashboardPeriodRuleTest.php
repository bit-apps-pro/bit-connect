<?php

namespace BitApps\BitConnect\Tests\Http;

use BitApps\BitConnect\Deps\BitApps\WPValidator\Validator;
use BitApps\BitConnect\Http\Requests\GetDashboardRequest;
use PHPUnit\Framework\TestCase;

/**
 * The periods the dashboard will count over.
 *
 * The controller turns the period straight into a date boundary and a bucket
 * count, so anything outside the three the admin screen offers is refused with
 * a 422 rather than read as the default. Run through the real validator: a rule
 * compared only as an array stays green while it cannot execute.
 *
 * @internal
 *
 * @coversNothing
 */
final class DashboardPeriodRuleTest extends TestCase
{
    /**
     * @return array<string, array{0: null|string}>
     */
    public static function accepted(): array
    {
        return [
            'seven days'    => ['7d'],
            'thirty days'   => ['30d'],
            'twelve months' => ['12m'],
            'omitted'       => [null],
        ];
    }

    /**
     * @return array<string, array{0: string}>
     */
    public static function refused(): array
    {
        return [
            'unknown'     => ['90d'],
            'wrong case'  => ['7D'],
            'injection'   => ["30d' OR 1=1"],
            'empty-ish'   => [' '],
        ];
    }

    /**
     * @dataProvider accepted
     */
    public function testAcceptsTheOfferedPeriods(?string $period): void
    {
        $this->assertFalse($this->validate($period)->fails());
    }

    /**
     * @dataProvider refused
     */
    public function testRefusesAnythingElse(string $period): void
    {
        $this->assertTrue($this->validate($period)->fails());
    }

    private function validate(?string $period): object
    {
        $data = $period === null ? [] : ['period' => $period];

        return (new Validator())->make($data, (new GetDashboardRequest())->rules());
    }
}
