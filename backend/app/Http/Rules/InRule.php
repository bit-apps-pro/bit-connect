<?php

namespace BitApps\BitConnect\Http\Rules;

if (!defined('ABSPATH')) {
    exit;
}

use BitApps\BitConnect\Deps\BitApps\WPValidator\Rule;

/**
 * An allowlist: the value must be one of the given strings.
 *
 * wp-validator ships no `in` rule, and naming one as the string `'in:a,b'`
 * throws an uncaught RuleErrorException — a fatal on the request, not a 422.
 * Pass an instance instead: `new InRule(['publish'])`.
 *
 * The validator hands an object rule itself as its rule name and can carry the
 * parameters of the string rule before it into this one, so both setters are
 * pinned here. The name stays `in`, which keeps `field.in` custom messages
 * matching.
 */
final class InRule extends Rule
{
    /** @var string[] */
    private $allowed;

    /**
     * @param string[] $allowed
     */
    public function __construct(array $allowed)
    {
        $this->allowed = array_map('strval', $allowed);
    }

    public function validate($value)
    {
        return \is_scalar($value) && \in_array((string) $value, $this->allowed, true);
    }

    public function message()
    {
        return __('The :attribute is not one of the accepted values.', 'bit-connect');
    }

    public function setRuleName($ruleName): void
    {
        parent::setRuleName('in');
    }

    public function getParamKeys()
    {
        return [];
    }

    public function setParameterValues($paramKeys, $paramValues): void {}

    /**
     * @return string[]
     */
    public function allowed(): array
    {
        return $this->allowed;
    }
}
