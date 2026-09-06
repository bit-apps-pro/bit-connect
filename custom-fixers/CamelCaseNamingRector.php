<?php

declare(strict_types=1);

namespace BitApps\BitConnect\Fixers;

use PhpParser\Node;
use Rector\Rector\AbstractRector;
use Symplify\RuleDocGenerator\ValueObject\RuleDefinition;

if (!defined('ABSPATH')) {
    exit;
}


final class CamelCaseNamingRector extends AbstractRector
{
    public function getRuleDefinition(): RuleDefinition
    {
        return new RuleDefinition('Convert names to camelCase', []);
    }

    public function getNodeTypes(): array
    {
        return [Node\Expr\Variable::class];
    }

    public function refactor(Node $node): ?Node
    {
        if (!$node instanceof Node\Expr\Variable) {
            return null;
        }

        $name = $node->name;

        if (\is_string($name) && !ctype_lower($name)) {
            $node->name = lcfirst(str_replace('_', '', ucwords($name, '_')));
        }

        return $node;
    }
}
