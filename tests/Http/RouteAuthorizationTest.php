<?php

namespace BitApps\BitConnect\Tests\Http;

use PHPUnit\Framework\TestCase;

/**
 * Every route must be able to say no.
 *
 * The API router registers each route with a permissive `permission_callback`
 * and only runs `authorize()` when it resolves a Request subclass from the
 * action's own signature. Authorization is therefore opt-in by type hint: an
 * action written without a Request parameter, or with a Request class that
 * never defines `authorize()`, is served to anyone on the internet — silently,
 * with no error and nothing in the log. That is exactly how the portal-page
 * endpoints came to accept unauthenticated writes to `show_on_front`.
 *
 * This test is the missing "deny by default". It reads the route files the way
 * the router does, follows each action to its controller, and fails the build
 * if a route has no way to refuse. Everything genuinely public is named in
 * PUBLIC_ROUTES below with the reason it is public — adding a route to that
 * list is a deliberate act somebody has to review.
 *
 * Deliberately static: it parses source rather than booting WordPress, so it
 * cannot be fooled by a runtime hook and runs in milliseconds.
 *
 * @internal
 *
 * @coversNothing
 */
final class RouteAuthorizationTest extends TestCase
{
    /**
     * Routes that answer without authorization, and why.
     *
     * Keyed by "METHOD path" exactly as declared in the route file. A route
     * belongs here only when an anonymous visitor is *supposed* to reach it.
     */
    private const PUBLIC_ROUTES = [
        // The portal bootstraps from this before anyone has logged in: it
        // returns the login/registration URLs and whether registration is even
        // open. It exposes no member data for a logged-out caller.
        'GET auth/data' => 'Portal auth bootstrap — must answer logged-out visitors.',

        // Ending your own session. Reads the current user and nothing else;
        // there is no id to pass, so there is no one else\'s session to end.
        'POST ajax_logout' => 'Logout — acts only on the caller\'s own session.',
    ];

    /**
     * @return array<string, array{0: string}>
     */
    public static function routeFileProvider(): array
    {
        return [
            'api'  => ['backend/hooks/api.php'],
            'ajax' => ['backend/hooks/ajax.php'],
        ];
    }

    /**
     * @dataProvider routeFileProvider
     */
    public function testEveryRouteCanRefuseAnAnonymousCaller(string $routeFile): void
    {
        $root = \dirname(__DIR__, 2);
        $routes = self::parseRoutes($root . '/' . $routeFile);

        $this->assertNotEmpty($routes, "No routes parsed from {$routeFile} — the parser has drifted from the route syntax.");

        $unprotected = [];

        foreach ($routes as $route) {
            $key = $route['method'] . ' ' . $route['path'];

            if (isset(self::PUBLIC_ROUTES[$key])) {
                continue;
            }

            // A route that declares middleware is gated before the action runs.
            if ($route['middleware'] !== []) {
                continue;
            }

            $requestClass = self::firstParameterType($root, $route['controller'], $route['action']);

            if ($requestClass === null) {
                $unprotected[] = "{$key}  →  {$route['controller']}::{$route['action']}() takes no Request, so authorize() never runs";

                continue;
            }

            if (!self::declaresAuthorize($root, $requestClass)) {
                $unprotected[] = "{$key}  →  {$requestClass} defines no authorize()";
            }
        }

        $this->assertSame(
            [],
            $unprotected,
            "These routes cannot refuse an anonymous caller:\n  - " . implode("\n  - ", $unprotected)
                . "\n\nGive the action a Request whose authorize() checks a capability, attach middleware,"
                . "\nor — if it really is public — add it to RouteAuthorizationTest::PUBLIC_ROUTES with a reason."
        );
    }

    /**
     * Guard the guard: a stale entry in the allowlist is a route nobody is
     * checking any more.
     */
    public function testThePublicAllowlistHasNoStaleEntries(): void
    {
        $root = \dirname(__DIR__, 2);
        $declared = [];

        foreach (['backend/hooks/api.php', 'backend/hooks/ajax.php'] as $file) {
            foreach (self::parseRoutes($root . '/' . $file) as $route) {
                $declared[] = $route['method'] . ' ' . $route['path'];
            }
        }

        foreach (array_keys(self::PUBLIC_ROUTES) as $allowed) {
            $this->assertContains(
                $allowed,
                $declared,
                "PUBLIC_ROUTES names '{$allowed}', which no longer exists. Remove it."
            );
        }
    }

    /**
     * Pull every Route::method('path', [Controller::class, 'action']) out of a
     * route file, together with any chained ->middleware(...).
     *
     * @return array<int, array{method: string, path: string, controller: string, action: string, middleware: array<int, string>}>
     */
    private static function parseRoutes(string $file): array
    {
        $source = (string) file_get_contents($file);
        $imports = self::imports($source);

        preg_match_all(
            '/Route::(get|post|put|delete|match)\(\s*'
            . '[\'"]([^\'"]+)[\'"]\s*,\s*'
            . '\[\s*([A-Za-z0-9_\\\\]+)::class\s*,\s*[\'"]([A-Za-z0-9_]+)[\'"]\s*\]\s*'
            . '\)((?:\s*->\s*middleware\([^)]*\))*)/',
            $source,
            $matches,
            PREG_SET_ORDER
        );

        $routes = [];

        foreach ($matches as $match) {
            preg_match_all('/[\'"]([^\'"]+)[\'"]/', $match[5], $middlewareMatches);

            $shortName = $match[3];

            $routes[] = [
                'method'     => strtoupper($match[1]),
                'path'       => $match[2],
                'controller' => $imports[$shortName] ?? $shortName,
                'action'     => $match[4],
                'middleware' => $middlewareMatches[1] ?? [],
            ];
        }

        return $routes;
    }

    /**
     * Map the short class names a route file uses back to their fully qualified
     * names, from its own `use` statements.
     *
     * @return array<string, string>
     */
    private static function imports(string $source): array
    {
        preg_match_all('/^use\s+([A-Za-z0-9_\\\\]+);/m', $source, $matches);

        $imports = [];

        foreach ($matches[1] as $fqcn) {
            $parts = explode('\\', $fqcn);
            $imports[end($parts)] = $fqcn;
        }

        return $imports;
    }

    /**
     * The fully qualified type of an action's first parameter, or null when it
     * takes none.
     */
    private static function firstParameterType(string $root, string $controller, string $action): ?string
    {
        $file = self::classFile($root, $controller);

        if ($file === null) {
            return null;
        }

        $source = (string) file_get_contents($file);

        if (!preg_match('/function\s+' . preg_quote($action, '/') . '\s*\(([^)]*)\)/', $source, $signature)) {
            return null;
        }

        $params = trim($signature[1]);

        if ($params === '') {
            return null;
        }

        // "?Foo $bar = null" / "Foo $bar" — we only want Foo.
        if (!preg_match('/^\??\s*([A-Za-z0-9_\\\\]+)\s+\$/', $params, $type)) {
            return null;
        }

        return self::imports($source)[$type[1]] ?? $type[1];
    }

    /**
     * Whether a Request class — or anything it extends inside the plugin —
     * defines authorize().
     */
    private static function declaresAuthorize(string $root, string $requestClass): bool
    {
        $file = self::classFile($root, $requestClass);

        if ($file === null) {
            // Not one of ours: the base Deps Request, which defines no
            // authorize() and therefore protects nothing.
            return false;
        }

        return (bool) preg_match('/function\s+authorize\s*\(/', (string) file_get_contents($file));
    }

    /**
     * Resolve a plugin class to its file via the PSR-4 root in composer.json.
     */
    private static function classFile(string $root, string $fqcn): ?string
    {
        $prefix = 'BitApps\\BitConnect\\';

        if (!str_starts_with($fqcn, $prefix) || str_starts_with($fqcn, $prefix . 'Deps\\')) {
            return null;
        }

        $relative = str_replace('\\', '/', substr($fqcn, \strlen($prefix)));
        $file = $root . '/backend/app/' . $relative . '.php';

        return is_readable($file) ? $file : null;
    }
}
