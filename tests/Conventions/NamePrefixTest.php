<?php

namespace BitApps\BitConnect\Tests\Conventions;

use PHPUnit\Framework\TestCase;
use RecursiveDirectoryIterator;
use RecursiveIteratorIterator;
use SplFileInfo;

/**
 * Every name this plugin registers with WordPress or writes to shared storage
 * carries the `bit_connect_` prefix.
 *
 * The WordPress.org directory requires it — options, transients, meta keys,
 * post types, post statuses, roles, script handles, query vars and hook names
 * all live in namespaces shared with every other plugin on the site — and the
 * 1.0.0 review asked for it explicitly. This test is the guard: a new key that
 * forgets the prefix fails here, in the suite, before it reaches a reviewer.
 *
 * The keys are deliberately literal in the source rather than built from
 * `Config::VAR_PREFIX`. They are persisted identifiers: once a site holds data
 * under them, the constant is no longer a free parameter, and a literal is
 * what the review tooling (and a human reading a `set_transient()` call) can
 * verify without opening another file. That is also why hook names are fired
 * as literals — the coding-standards prefix sniff cannot evaluate a dynamic
 * name and skips it.
 *
 * What is checked: the first argument of every registering or writing call
 * (see WRITERS), when it can be read statically. A string literal is read
 * directly; a class constant is resolved from its declaration in the same
 * file; `Config::withPrefix()` and `Config::VAR_PREFIX . …` count as prefixed
 * by construction. A plain variable cannot be verified here and is skipped —
 * the callers that build keys at runtime (the rate limiters, the pending
 * registration transient) are covered by their own tests, which assert the
 * exact key.
 */
final class NamePrefixTest extends TestCase
{
    /**
     * Accepts `bit_connect_…`, `_bit_connect_…` (hidden meta), and the
     * `bit_connect/…` form used by a couple of namespaced filters.
     */
    private const PREFIX_PATTERN = '/^_?bit_connect[_\/]/';

    /**
     * Calls whose first argument names something in a shared namespace.
     * Listeners (`add_action`, `add_filter`) are not here: attaching to a
     * core hook is the plugin's business, declaring one is what needs a prefix.
     */
    private const WRITERS = [
        'update_option', 'add_option', 'delete_option',
        'set_transient', 'set_site_transient',
        'update_post_meta', 'add_post_meta',
        'update_user_meta', 'add_user_meta',
        'update_comment_meta', 'add_comment_meta',
        'update_term_meta', 'add_term_meta',
        'register_post_status', 'register_post_type', 'register_taxonomy',
        'add_shortcode', 'add_role', 'register_setting',
        'wp_register_script', 'wp_register_style',
        'wp_enqueue_script', 'wp_enqueue_style', 'wp_localize_script',
        'add_menu_page', 'add_submenu_page',
        'wp_schedule_event', 'wp_schedule_single_event',
        'do_action', 'apply_filters',
        'Hooks::doAction', 'Hooks::applyFilter',
    ];

    /**
     * WordPress core names the plugin touches on purpose. Each is core's own
     * key, so a prefix would be wrong; listing them keeps the reason next to
     * the exemption.
     */
    private const CORE_NAMES = [
        // PortalSlugController: making the portal page the site front page.
        'show_on_front', 'page_on_front',
        // TopicService: pinning a topic is core's sticky list.
        'sticky_posts',
        // Flushed after a slug change; core recomputes it lazily.
        'rewrite_rules',
        // Core filters the plugin applies to its own output, not ones it declares.
        'the_content', 'comment_text', 'big_image_size_threshold',
    ];

    public function testEveryRegisteredOrStoredNameCarriesThePrefix(): void
    {
        $offenders = [];

        foreach (self::sourceFiles() as $file) {
            $tokens = token_get_all(file_get_contents($file));
            $constants = self::constantDeclarations($tokens);

            foreach (self::writerCalls($tokens) as [$line, $function, $argument]) {
                $name = self::resolve($argument, $constants);

                if ($name === null || \in_array($name, self::CORE_NAMES, true)) {
                    continue;
                }

                if (!preg_match(self::PREFIX_PATTERN, $name)) {
                    $offenders[] = sprintf('%s:%d %s(%s)', self::relative($file), $line, $function, var_export($name, true));
                }
            }
        }

        $this->assertSame([], $offenders, "Names without the bit_connect_ prefix:\n" . implode("\n", $offenders));
    }

    public function testEveryQueryVarCarriesThePrefix(): void
    {
        $offenders = [];

        foreach (self::sourceFiles() as $file) {
            // Query vars are registered by appending to the array the
            // `query_vars` filter hands over, so there is no function to key on.
            if (preg_match_all('/\$vars\[\]\s*=\s*([\'"])([^\'"]+)\1/', file_get_contents($file), $matches)) {
                foreach ($matches[2] as $name) {
                    if (!preg_match(self::PREFIX_PATTERN, $name)) {
                        $offenders[] = self::relative($file) . ' ' . $name;
                    }
                }
            }
        }

        $this->assertSame([], $offenders, "Query vars without the bit_connect_ prefix:\n" . implode("\n", $offenders));
    }

    public function testFiredHookNamesAreLiteral(): void
    {
        $dynamic = [];

        foreach (self::sourceFiles() as $file) {
            $tokens = token_get_all(file_get_contents($file));

            foreach (self::writerCalls($tokens) as [$line, $function, $argument]) {
                if (!\in_array($function, ['do_action', 'apply_filters', 'Hooks::doAction', 'Hooks::applyFilter'], true)) {
                    continue;
                }

                if (!self::isStringLiteral($argument)) {
                    $dynamic[] = sprintf('%s:%d %s(%s)', self::relative($file), $line, $function, self::render($argument));
                }
            }
        }

        $this->assertSame(
            [],
            $dynamic,
            "Hook names must be string literals so the prefix sniff can read them:\n" . implode("\n", $dynamic)
        );
    }

    /**
     * @return list<string>
     */
    private static function sourceFiles(): array
    {
        $root = \dirname(__DIR__, 2) . '/backend';
        $files = [];

        /** @var SplFileInfo $file */
        foreach (new RecursiveIteratorIterator(new RecursiveDirectoryIterator($root)) as $file) {
            if ($file->getExtension() === 'php') {
                $files[] = $file->getPathname();
            }
        }

        sort($files);

        return $files;
    }

    private static function relative(string $path): string
    {
        return substr($path, \strlen(\dirname(__DIR__, 2)) + 1);
    }

    /**
     * Every WRITERS call in the token stream with the tokens of its first
     * argument.
     *
     * @param list<array|string> $tokens
     *
     * @return list<array{0:int,1:string,2:list<array|string>}>
     */
    private static function writerCalls(array $tokens): array
    {
        $calls = [];
        $count = \count($tokens);

        for ($i = 0; $i < $count; $i++) {
            $function = self::calledFunction($tokens, $i);

            if ($function === null) {
                continue;
            }

            $open = self::nextSignificant($tokens, $i + 1);

            if ($open === null || $tokens[$open] !== '(') {
                continue;
            }

            $argument = [];
            $depth = 0;

            for ($j = $open + 1; $j < $count; $j++) {
                $token = $tokens[$j];

                if ($token === '(' || $token === '[') {
                    $depth++;
                } elseif ($token === ')' || $token === ']') {
                    if ($depth === 0) {
                        break;
                    }
                    $depth--;
                } elseif ($token === ',' && $depth === 0) {
                    break;
                }

                if (!\is_array($token) || !\in_array($token[0], [T_WHITESPACE, T_COMMENT, T_DOC_COMMENT], true)) {
                    $argument[] = $token;
                }
            }

            if ($argument !== []) {
                $calls[] = [$tokens[$i][2], $function, $argument];
            }
        }

        return $calls;
    }

    /**
     * The WRITERS entry at $i, if the token there starts one: either a bare
     * function name or `Hooks::method`. Method calls (`->update_option`) and
     * namespaced references (`Foo\update_option`) are not matches.
     *
     * @param list<array|string> $tokens
     */
    private static function calledFunction(array $tokens, int $i): ?string
    {
        $token = $tokens[$i];

        if (!\is_array($token) || $token[0] !== T_STRING) {
            return null;
        }

        $previous = self::previousSignificant($tokens, $i - 1);

        if ($previous !== null && \is_array($tokens[$previous])
            && \in_array($tokens[$previous][0], [T_OBJECT_OPERATOR, T_NULLSAFE_OBJECT_OPERATOR, T_FUNCTION, T_NS_SEPARATOR, T_CONST], true)) {
            return null;
        }

        if ($token[1] === 'Hooks') {
            $colon = self::nextSignificant($tokens, $i + 1);
            $method = $colon === null ? null : self::nextSignificant($tokens, $colon + 1);

            if ($colon !== null && $method !== null && \is_array($tokens[$colon]) && $tokens[$colon][0] === T_DOUBLE_COLON
                && \is_array($tokens[$method]) && \in_array('Hooks::' . $tokens[$method][1], self::WRITERS, true)) {
                return 'Hooks::' . $tokens[$method][1];
            }

            return null;
        }

        if ($previous !== null && \is_array($tokens[$previous]) && $tokens[$previous][0] === T_DOUBLE_COLON) {
            return null;
        }

        return \in_array($token[1], self::WRITERS, true) ? $token[1] : null;
    }

    /**
     * `const NAME = <expression>;` declarations, keyed by name, with the
     * expression as tokens.
     *
     * @param list<array|string> $tokens
     *
     * @return array<string, list<array|string>>
     */
    private static function constantDeclarations(array $tokens): array
    {
        $constants = [];
        $count = \count($tokens);

        for ($i = 0; $i < $count; $i++) {
            if (!\is_array($tokens[$i]) || $tokens[$i][0] !== T_CONST) {
                continue;
            }

            $name = self::nextSignificant($tokens, $i + 1);
            $equals = $name === null ? null : self::nextSignificant($tokens, $name + 1);

            if ($name === null || $equals === null || $tokens[$equals] !== '=' || !\is_array($tokens[$name])) {
                continue;
            }

            $expression = [];

            for ($j = $equals + 1; $j < $count && $tokens[$j] !== ';'; $j++) {
                if (!\is_array($tokens[$j]) || !\in_array($tokens[$j][0], [T_WHITESPACE, T_COMMENT, T_DOC_COMMENT], true)) {
                    $expression[] = $tokens[$j];
                }
            }

            $constants[$tokens[$name][1]] = $expression;
        }

        return $constants;
    }

    /**
     * The static string an argument expression starts with, or null when it
     * cannot be known without running the code.
     *
     * Concatenation only needs its first operand: the prefix is what matters,
     * and `self::KEY_PREFIX . $token` is prefixed if KEY_PREFIX is.
     *
     * @param list<array|string>               $argument
     * @param array<string, list<array|string>> $constants
     */
    private static function resolve(array $argument, array $constants, int $depth = 0): ?string
    {
        if ($argument === [] || $depth > 5) {
            return null;
        }

        $first = $argument[0];

        if (\is_array($first) && $first[0] === T_CONSTANT_ENCAPSED_STRING) {
            return self::unquote($first[1]);
        }

        // `Config::withPrefix(…)` and `Config::VAR_PREFIX . …` are prefixed by
        // construction; `self::NAME` / `static::NAME` resolve to a declaration.
        if (\is_array($first) && $first[0] === T_STRING && $first[1] === 'Config'
            && isset($argument[2]) && \is_array($argument[2])
            && \in_array($argument[2][1], ['withPrefix', 'VAR_PREFIX'], true)) {
            return 'bit_connect_';
        }

        $isSelf = \is_array($first) && \in_array($first[0], [T_STRING, T_STATIC], true) && \in_array($first[1], ['self', 'static'], true);

        if ($isSelf && isset($argument[1], $argument[2]) && \is_array($argument[2]) && $argument[2][0] === T_STRING) {
            $name = $argument[2][1];

            return isset($constants[$name]) ? self::resolve($constants[$name], $constants, $depth + 1) : null;
        }

        return null;
    }

    /**
     * @param list<array|string> $argument
     */
    private static function isStringLiteral(array $argument): bool
    {
        return \count($argument) === 1 && \is_array($argument[0]) && $argument[0][0] === T_CONSTANT_ENCAPSED_STRING;
    }

    /**
     * @param list<array|string> $argument
     */
    private static function render(array $argument): string
    {
        return implode('', array_map(static fn ($token) => \is_array($token) ? $token[1] : $token, $argument));
    }

    private static function unquote(string $literal): string
    {
        return stripcslashes(substr($literal, 1, -1));
    }

    /**
     * @param list<array|string> $tokens
     */
    private static function nextSignificant(array $tokens, int $from): ?int
    {
        for ($i = $from, $count = \count($tokens); $i < $count; $i++) {
            if (!\is_array($tokens[$i]) || !\in_array($tokens[$i][0], [T_WHITESPACE, T_COMMENT, T_DOC_COMMENT], true)) {
                return $i;
            }
        }

        return null;
    }

    /**
     * @param list<array|string> $tokens
     */
    private static function previousSignificant(array $tokens, int $from): ?int
    {
        for ($i = $from; $i >= 0; $i--) {
            if (!\is_array($tokens[$i]) || !\in_array($tokens[$i][0], [T_WHITESPACE, T_COMMENT, T_DOC_COMMENT], true)) {
                return $i;
            }
        }

        return null;
    }
}
