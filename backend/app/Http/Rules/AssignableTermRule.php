<?php

namespace BitApps\BitConnect\Http\Rules;

if (!defined('ABSPATH')) {
    exit;
}

use BitApps\BitConnect\Deps\BitApps\WPValidator\Rule;
use BitApps\BitConnect\Services\TopicTaxonomies;

/**
 * A term of an added taxonomy the member may file their topic under.
 *
 * The taxonomy's own entry decides, through its `assignable` check — see
 * TopicTaxonomies. Without one, every term may be chosen and this passes.
 * An empty value passes too: whether one is required is the `required` rule's
 * question, not this one's.
 */
final class AssignableTermRule extends Rule
{
    public function __construct(private string $param) {}

    /** What the rule admits, for anything that reads a rule list as text. */
    public function __toString(): string
    {
        return 'assignable term';
    }

    public function validate($value)
    {
        if ($value === null || $value === '') {
            return true;
        }

        return TopicTaxonomies::mayAssign($this->param, (int) $value, get_current_user_id());
    }

    public function message()
    {
        return __('You cannot post a topic there.', 'bit-connect');
    }

    public function getParamKeys()
    {
        return [];
    }

    public function setParameterValues($paramKeys, $paramValues): void {}
}
