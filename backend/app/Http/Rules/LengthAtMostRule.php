<?php

namespace BitApps\BitConnect\Http\Rules;

if (!defined('ABSPATH')) {
    exit;
}

use BitApps\BitConnect\Deps\BitApps\WPValidator\Rule;

/**
 * An upper bound on a string's length, the empty string included.
 *
 * wp-validator's `max` returns false for a value of length 0 whatever the
 * bound, the string twin of what AtMostRule works around for numbers. A field
 * that is `sanitize:title` can arrive non-empty and leave sanitizing empty —
 * a slug of "---" — and `'max:200'` then refuses it with "cannot exceed 200
 * characters". Pass an instance instead: `new LengthAtMostRule(200)`.
 *
 * The rule name stays `max`, so `field.max` custom messages still apply.
 */
final class LengthAtMostRule extends Rule
{
    private int $bound;

    public function __construct(int $bound)
    {
        $this->bound = $bound;
    }

    public function validate($value)
    {
        return \is_string($value) && mb_strlen($value) <= $this->bound;
    }

    public function message()
    {
        // translators: %s: the most characters accepted.
        return \sprintf(__('The :attribute may not be greater than %s characters.', 'bit-connect'), $this->bound);
    }

    public function setRuleName($ruleName): void
    {
        parent::setRuleName('max');
    }

    public function getParamKeys()
    {
        return [];
    }

    public function setParameterValues($paramKeys, $paramValues): void {}
}
