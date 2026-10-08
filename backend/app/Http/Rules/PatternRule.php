<?php

namespace BitApps\BitConnect\Http\Rules;

if (!defined('ABSPATH')) {
    exit;
}

use BitApps\BitConnect\Deps\BitApps\WPValidator\Rule;

/**
 * The value must be a string matching a regular expression.
 *
 * wp-validator ships no `regex` rule, and naming one as a string is a fatal on
 * the request rather than a 422 (see InRule). Pass an instance instead:
 * `new PatternRule('/^[a-f0-9]{32}$/')`.
 */
final class PatternRule extends Rule
{
    /** @var string */
    private $pattern;

    public function __construct(string $pattern)
    {
        $this->pattern = $pattern;
    }

    public function validate($value)
    {
        return \is_string($value) && preg_match($this->pattern, $value) === 1;
    }

    public function message()
    {
        return __('The :attribute is not in the expected format.', 'bit-connect');
    }

    public function setRuleName($ruleName): void
    {
        parent::setRuleName('pattern');
    }

    public function getParamKeys()
    {
        return [];
    }

    public function setParameterValues($paramKeys, $paramValues): void {}
}
