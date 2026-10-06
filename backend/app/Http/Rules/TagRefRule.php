<?php

namespace BitApps\BitConnect\Http\Rules;

if (!defined('ABSPATH')) {
    exit;
}

use BitApps\BitConnect\Deps\BitApps\WPValidator\Rule;
use BitApps\BitConnect\Services\TagResolverService;

/**
 * One entry of a topic's `tags`: the id of a tag from the list, or the name
 * of one the member typed. TagResolverService turns either into an id.
 *
 * The rule name stays `integer`, so the `tags.*.integer` message applies.
 */
final class TagRefRule extends Rule
{
    /** What the rule admits, for anything that reads a rule list as text. */
    public function __toString(): string
    {
        return 'tag id or name';
    }

    public function validate($value)
    {
        if (\is_int($value) || (\is_string($value) && ctype_digit($value))) {
            return (int) $value >= 1;
        }

        if (!\is_string($value)) {
            return false;
        }

        $length = mb_strlen(trim($value));

        return $length >= 1 && $length <= TagResolverService::MAX_NAME_LENGTH;
    }

    public function message()
    {
        // translators: %d: the longest tag name accepted.
        return \sprintf(__('Each tag must be a tag from the list or a name of up to %d characters.', 'bit-connect'), TagResolverService::MAX_NAME_LENGTH);
    }

    public function setRuleName($ruleName): void
    {
        parent::setRuleName('integer');
    }

    public function getParamKeys()
    {
        return [];
    }

    public function setParameterValues($paramKeys, $paramValues): void {}
}
