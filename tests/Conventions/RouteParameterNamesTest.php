<?php

namespace BitApps\BitConnect\Tests\Conventions;

use PHPUnit\Framework\TestCase;
use ReflectionMethod;

/**
 * Every `{placeholder}` in a portal route names a parameter of its controller.
 *
 * The router binds placeholders to controller parameters by name, not by
 * position (see WPKit's RouteRegister). A mismatch is silent: the parameter
 * keeps its default and the route still answers 200. `/page/{pageNumber}` was
 * bound to `index($request, $page = 1)` that way, so every paginated list page
 * rendered — and described itself to search engines — as page 1.
 *
 * Read from the route file's source rather than from a booted router, so the
 * check needs nothing but the file and the controller classes.
 */
final class RouteParameterNamesTest extends TestCase
{
    private const ROUTE_FILE = __DIR__ . '/../../backend/hooks/static.php';

    public function testEveryPlaceholderNamesAControllerParameter(): void
    {
        $routes = $this->routes();

        $this->assertNotEmpty($routes, 'No routes were read from ' . self::ROUTE_FILE);

        foreach ($routes as [$path, $class, $method]) {
            preg_match_all('/\{(\w+)\}/', $path, $matches);

            $parameters = array_map(
                static fn ($parameter) => $parameter->getName(),
                (new ReflectionMethod($class, $method))->getParameters()
            );

            foreach ($matches[1] as $placeholder) {
                $this->assertContains(
                    $placeholder,
                    $parameters,
                    \sprintf('%s: {%s} is not a parameter of %s::%s()', $path, $placeholder, $class, $method)
                );
            }
        }
    }

    /**
     * @return array<int, array{0: string, 1: class-string, 2: string}>
     */
    private function routes(): array
    {
        $source = (string) file_get_contents(self::ROUTE_FILE);

        preg_match_all('/^use\s+([\w\\\]+);/m', $source, $uses);

        $imports = [];

        foreach ($uses[1] as $import) {
            $imports[substr((string) strrchr('\\' . $import, '\\'), 1)] = $import;
        }

        preg_match_all(
            "/^Route::\w+\('([^']+)',\s*\[new\s+(\w+)\(\),\s*'(\w+)'\]\)/m",
            $source,
            $matches,
            PREG_SET_ORDER
        );

        $routes = [];

        foreach ($matches as [, $path, $shortClass, $method]) {
            $routes[] = [$path, $imports[$shortClass] ?? $shortClass, $method];
        }

        return $routes;
    }
}
