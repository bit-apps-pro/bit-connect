<?php

namespace BitApps\BitConnect\Http\Rules;

if (!defined('ABSPATH')) {
    exit;
}

use BitApps\BitConnect\Deps\BitApps\WPValidator\Rule;

/**
 * An upper bound on a number, zero included.
 *
 * wp-validator's `max` returns false for 0 whatever the bound, for the same
 * reason its `min` does (see AtLeastRule), so `'max:23'` rejects hour 0. Pass an
 * instance instead: `new AtMostRule(23)`. For strings and arrays, keep using
 * `max`.
 *
 * The rule name stays `max`, so `field.max` custom messages still apply.
 */
final class AtMostRule extends Rule
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
        return is_numeric($value) && $value <= $this->bound;
    }

    public function message()
    {
        // translators: %s: the largest accepted number.
        return \sprintf(__('The :attribute may not be greater than %s.', 'bit-connect'), $this->bound);
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
