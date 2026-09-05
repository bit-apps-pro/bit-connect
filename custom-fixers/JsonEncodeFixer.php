<?php

namespace BitApps\BitConnect\Fixers;

use PhpCsFixer\Fixer\FixerInterface;
use PhpCsFixer\FixerDefinition\CodeSample;
use PhpCsFixer\FixerDefinition\FixerDefinition;
use PhpCsFixer\FixerDefinition\FixerDefinitionInterface;
use PhpCsFixer\Tokenizer\Token;
use PhpCsFixer\Tokenizer\Tokens;
use SplFileInfo;

final class JsonEncodeFixer implements FixerInterface
{
    public function getName(): string
    {
        return 'BitApps/replace_json_encode';
    }

    public function getPriority(): int
    {
        // priority of the fixer
        return 0;
    }

    public function isCandidate(Tokens $tokens): bool
    {
        // logic to determine if the file is a candidate for fixing
        return $tokens->isTokenKindFound(T_STRING);
    }

    public function isRisky(): bool
    {
        // return true if the fixer is risky
        return false;
    }

    public function supports(SplFileInfo $file): bool
    {
        // logic to determine if the fixer supports a given file
        return !($file->getFilename() === 'NamespaceUpdater.php');
    }

    public function fix(SplFileInfo $file, Tokens $tokens): void
    {
        $shimBodies = $this->shimBodyRanges($tokens);

        foreach ($tokens as $index => $token) {
            if (!$token->isGivenKind(T_STRING) || $token->getContent() !== 'json_encode') {
                continue;
            }

            if (!$this->isGlobalFunctionCall($tokens, $index)) {
                continue;
            }

            if ($this->isInsideAnyRange($index, $shimBodies)) {
                continue;
            }

            $tokens[$index] = new Token([T_STRING, 'wp_json_encode']);
        }
    }

    public function getDefinition(): FixerDefinitionInterface
    {
        return new FixerDefinition(
            'Replaces all instances of json_encode with wp_json_encode.',
            [
                new CodeSample("<?php\njson_encode(\$data);\n"),
                new CodeSample("<?php\nwp_json_encode(\$data);\n")
            ]
        );
    }

    /**
     * The bodies of any `function wp_json_encode()` declared in this file.
     *
     * A shim's whole job is to call the real thing, so the one place
     * `json_encode` must survive untouched is inside the function that
     * replaces it. Rewriting it there produced a function that called itself
     * forever — which is exactly what happened to the PHPUnit bootstrap stub,
     * and it presents as the test run being OOM-killed rather than as anything
     * to do with formatting.
     *
     * @return array<int, array{0: int, 1: int}> [openBrace, closeBrace] pairs
     */
    private function shimBodyRanges(Tokens $tokens): array
    {
        $ranges = [];

        foreach ($tokens as $index => $token) {
            if (!$token->isGivenKind(T_FUNCTION)) {
                continue;
            }

            $nameIndex = $tokens->getNextMeaningfulToken($index);

            if ($nameIndex === null || $tokens[$nameIndex]->getContent() !== 'wp_json_encode') {
                continue;
            }

            $openIndex = $tokens->getNextTokenOfKind($nameIndex, ['{']);

            if ($openIndex === null) {
                continue;
            }

            $ranges[] = [$openIndex, $tokens->findBlockEnd(Tokens::BLOCK_TYPE_CURLY_BRACE, $openIndex)];
        }

        return $ranges;
    }

    /**
     * @param array<int, array{0: int, 1: int}> $ranges
     */
    private function isInsideAnyRange(int $index, array $ranges): bool
    {
        foreach ($ranges as [$start, $end]) {
            if ($index > $start && $index < $end) {
                return true;
            }
        }

        return false;
    }

    /**
     * Whether this `json_encode` is really a call to PHP's own function.
     *
     * The name alone is not enough. Rewriting every matching T_STRING also
     * renamed declarations, method calls and property names — and, worst of
     * all, the body of a `function wp_json_encode()` shim, which then called
     * itself until the process ran out of memory. That is not hypothetical: it
     * is what this fixer did to the PHPUnit bootstrap's stub.
     *
     * Four things disqualify a match:
     *
     * - `function json_encode(` — a declaration, not a call.
     * - `->json_encode(` / `::json_encode(` — somebody else's method.
     * - `Foo\json_encode(` — a namespaced function that is not PHP's.
     * - anything not followed by `(` — a constant, a property, a string.
     *
     * A leading `\` is fine and stays: `\json_encode(...)` is the global one.
     */
    private function isGlobalFunctionCall(Tokens $tokens, int $index): bool
    {
        $next = $tokens->getNextMeaningfulToken($index);

        if ($next === null || !$tokens[$next]->equals('(')) {
            return false;
        }

        $prev = $tokens->getPrevMeaningfulToken($index);

        if ($prev === null) {
            return true;
        }

        if ($tokens[$prev]->isGivenKind([T_FUNCTION, T_OBJECT_OPERATOR, T_DOUBLE_COLON, T_STRING])) {
            return false;
        }

        // T_NS_SEPARATOR is only acceptable at the root: `\json_encode()` is
        // PHP's, `Vendor\json_encode()` is not.
        if ($tokens[$prev]->isGivenKind(T_NS_SEPARATOR)) {
            $beforeSeparator = $tokens->getPrevMeaningfulToken($prev);

            return $beforeSeparator === null
                || !$tokens[$beforeSeparator]->isGivenKind([T_STRING, T_NS_SEPARATOR]);
        }

        return true;
    }
}
