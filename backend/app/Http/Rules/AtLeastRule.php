<?php

namespace BitApps\BitConnect\Http\Rules;

if (!defined('ABSPATH')) {
    exit;
}

use BitApps\BitConnect\Deps\BitApps\WPValidator\Rule;

/**
 * A lower bound on a number, zero included.
 *
 * wp-validator's `min` returns false for 0 whatever the bound — it reads the
 * value as a "length" and treats a zero length as a failure — so `'min:0'`
 * rejects the one value it was written to admit. Pass an instance instead:
 * `new AtLeastRule(0)`. For strings and arrays, keep using `min`.
 *
 * The rule name stays `min`, so `field.min` custom messages still apply; see
 * InRule for why the setters are pinned.
 */
final class AtLeastRule extends Rule
{
    /** @var float|int */
    private $bound;

    /**
     * @param float|int $bound
     */
    public function __construct($bound)
    {
        $this->bound = $bound;
    }

    public function validate($value)
    {
        return is_numeric($value) && $value >= $this->bound;
    }

    public function message()
    {
        // translators: %s: the smallest accepted number.
        return \sprintf(__('The :attribute must be at least %s.', 'bit-connect'), $this->bound);
    }

    public function setRuleName($ruleName): void
    {
        parent::setRuleName('min');
    }

    public function getParamKeys()
    {
        return [];
    }

    public function setParameterValues($paramKeys, $paramValues): void {}
}
