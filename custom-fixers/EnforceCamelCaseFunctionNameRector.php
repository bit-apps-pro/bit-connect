<?php

namespace BitApps\BitConnect\Fixers;

use PhpParser\Node;
use PhpParser\Node\Stmt\Function_;
use Rector\Rector\AbstractRector;
use Symplify\RuleDocGenerator\ValueObject\RuleDefinition;

if (!defined('ABSPATH')) {
    exit;
}


final class EnforceCamelCaseFunctionNameRector extends AbstractRector
{
    // public function __construct(
    //     private readonly NodeNameResolver $nodeNameResolver
    // ) {
    // }

    public function getRuleDefinition(): RuleDefinition
    {
        return new RuleDefinition(
            'Rename function names to camelCase',
            []
        );
    }

    public function getNodeTypes(): array
    {
        return [Function_::class];
    }

    public function refactor(Node $node): ?Node
    {
        if (!$node instanceof Function_) {
            return null;
        }

        $functionName = $this->getName($node);

        if (!$functionName || $this->isCamelCase($functionName)) {
            return null;
        }

        $newFunctionName = $this->toCamelCase($functionName);

        // Rename the function
        $this->renameNode($node, $newFunctionName);

        return $node;
    }

    private function isCamelCase(string $name): bool
    {
        return preg_match('/^[a-z][a-zA-Z0-9]*$/', $name) === 1;
    }

    private function toCamelCase(string $name): string
    {
        return lcfirst(str_replace('_', '', ucwords($name, '_')));
    }

    private function renameNode(Node $node, string $newName): void
    {
        $node->name = new Node\Identifier($newName);
    }
}
