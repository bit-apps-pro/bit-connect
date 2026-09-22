<?php

namespace BitApps\BitConnect\Tests\Http;

use BitApps\BitConnect\Deps\BitApps\WPValidator\Validator;
use PHPUnit\Framework\TestCase;

/**
 * Every rule every request declares must be one wp-validator can resolve.
 *
 * An unknown string rule — `'in:publish'` was the one that got through — is not
 * a validation failure but an uncaught RuleErrorException, so the endpoint
 * fatals on every call that sends the field. Nothing short of running the rules
 * notices: the requests compare fine as arrays.
 *
 * Each field is fed a non-empty value so `nullable` does not short-circuit the
 * rules behind it; whether the value passes is beside the point.
 *
 * @internal
 *
 * @coversNothing
 */
final class RequestRulesResolveTest extends TestCase
{
    /**
     * @return array<string, array{0: class-string}>
     */
    public static function requestClasses(): array
    {
        $cases = [];

        foreach (glob(\dirname(__DIR__, 2) . '/backend/app/Http/Requests/*.php') as $file) {
            $class = 'BitApps\\BitConnect\\Http\\Requests\\' . basename($file, '.php');

            $cases[basename($file, '.php')] = [$class];
        }

        return $cases;
    }

    /**
     * @dataProvider requestClasses
     *
     * @param class-string $class
     */
    public function testEveryRuleResolves(string $class): void
    {
        $request = new $class();

        if (!method_exists($request, 'rules')) {
            $this->addToAssertionCount(1);

            return;
        }

        $rules = $request->rules();
        $data  = [];

        foreach (array_keys($rules) as $field) {
            if (strpos($field, '.') === false) {
                $data[$field] ??= '1';

                continue;
            }

            // A wildcard rule walks into its parent, which has to be an array.
            $data[strtok($field, '.')] = ['1'];
        }

        (new Validator())->make($data, $rules);

        $this->addToAssertionCount(1);
    }
}
