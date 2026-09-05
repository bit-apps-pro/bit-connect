<?php

declare(strict_types=1);

use Rector\CodeQuality\Rector\ClassMethod\ExplicitReturnNullRector;
use Rector\CodeQuality\Rector\FuncCall\CompactToVariablesRector;
use Rector\Config\RectorConfig;
use Rector\DeadCode\Rector\If_\UnwrapFutureCompatibleIfPhpVersionRector;
use Rector\Set\ValueObject\SetList;
use Rector\ValueObject\PhpVersion;

return RectorConfig::configure()
    ->withPaths([
        __DIR__ . '/backend/app',
        __DIR__ . '/backend/hooks',
    ])
    ->withRules([
        CompactToVariablesRector::class,
    ])
    ->withPhpVersion(PhpVersion::PHP_74)
    ->withSkip([
        UnwrapFutureCompatibleIfPhpVersionRector::class,
        ExplicitReturnNullRector::class

    ])
    ->withPreparedSets(
        deadCode: true,
        codeQuality: true,
        // typeDeclarations: true,
        privatization: true,
        earlyReturn: true,
        // strictBooleans: true,
        // naming: true,
    )
    ->withSets([SetList::PHP_74]);
