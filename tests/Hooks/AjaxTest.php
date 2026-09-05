<?php

namespace BitApps\BitConnect\Deps\BitApps\WPKit\Http\Router {
    // Recording double for the Imposter-namespaced Route facade that ajax.php
    // registers against. The real Deps class only exists after a production
    // build, so in the dev/test autoloader this stub stands in for it and
    // captures every registration for assertion.
    if (!class_exists(Route::class, false)) {
        /**
         * Returned by each registration so `->middleware(...)` chains the way
         * the real router allows. It writes back into Route::$middleware rather
         * than into the recorded route, keeping the recorded shape to
         * method/path/action so route assertions stay readable.
         */
        final class RouteRegistration
        {
            private string $key;

            public function __construct(string $key)
            {
                $this->key = $key;
            }

            public function middleware(...$names): self
            {
                Route::$middleware[$this->key] = $names;

                return $this;
            }
        }

        final class Route
        {
            /** @var array<int, array{method: string, path: string, action: mixed}> */
            public static array $registered = [];

            /** @var array<string, array<int, string>> keyed by "method path" */
            public static array $middleware = [];

            public static function reset(): void
            {
                self::$registered = [];
                self::$middleware = [];
            }

            public static function get($path, $action): RouteRegistration
            {
                return self::record('get', $path, $action);
            }

            public static function post($path, $action): RouteRegistration
            {
                return self::record('post', $path, $action);
            }

            private static function record(string $method, $path, $action): RouteRegistration
            {
                self::$registered[] = ['method' => $method, 'path' => $path, 'action' => $action];

                return new RouteRegistration($method . ' ' . $path);
            }
        }
    }
}

namespace BitApps\BitConnect\Tests\Hooks {
    use BitApps\BitConnect\Deps\BitApps\WPKit\Http\Router\Route;
    use BitApps\BitConnect\Http\Controller\LoginController;
    use BitApps\BitConnect\Http\Controller\PluginImprovementController;
    use PHPUnit\Framework\TestCase;

    class AjaxTest extends TestCase
    {
        protected function setUp(): void
        {
            Route::reset();
            require __DIR__ . '/../../backend/hooks/ajax.php';
        }

        public function testRegistersExactlyFourRoutes(): void
        {
            $this->assertCount(4, Route::$registered);
        }

        public function testRegistersLoginRoute(): void
        {
            $this->assertContains(
                ['method' => 'post', 'path' => 'ajax_login', 'action' => [LoginController::class, 'login']],
                Route::$registered
            );
        }

        public function testRegistersLogoutRoute(): void
        {
            $this->assertContains(
                ['method' => 'post', 'path' => 'ajax_logout', 'action' => [LoginController::class, 'logout']],
                Route::$registered
            );
        }

        /**
         * The `pro_` prefix is deliberate and easy to mistake for a stray pro
         * route. The shared support screen asks for `pro_plugin-improvement`,
         * and this router prefixes with the free plugin's own `bit_connect_`,
         * so renaming it here silently breaks the consent checkbox.
         */
        public function testRegistersTelemetryConsentRoutesUnderTheNameTheSharedScreenAsksFor(): void
        {
            $this->assertContains(
                [
                    'method' => 'get',
                    'path'   => 'pro_plugin-improvement',
                    'action' => [PluginImprovementController::class, 'getData'],
                ],
                Route::$registered
            );
            $this->assertContains(
                [
                    'method' => 'post',
                    'path'   => 'pro_plugin-improvement',
                    'action' => [PluginImprovementController::class, 'createOrUpdate'],
                ],
                Route::$registered
            );
        }

        /**
         * Consent is a setting an administrator owns, and the write endpoint
         * changes it — so neither half may be reachable without the capability
         * and a nonce.
         */
        public function testTelemetryConsentRoutesAreGuarded(): void
        {
            $this->assertSame(['adminNonce'], Route::$middleware['get pro_plugin-improvement'] ?? []);
            $this->assertSame(['adminNonce'], Route::$middleware['post pro_plugin-improvement'] ?? []);
        }

        /**
         * The login routes stay open on purpose: a guest signing in has no
         * session to check. Everything else added here must not be.
         */
        public function testOnlyTheLoginRoutesAreUnguarded(): void
        {
            $unguarded = [];

            foreach (Route::$registered as $route) {
                $key = $route['method'] . ' ' . $route['path'];

                if (empty(Route::$middleware[$key])) {
                    $unguarded[] = $route['path'];
                }
            }

            sort($unguarded);

            $this->assertSame(['ajax_login', 'ajax_logout'], $unguarded);
        }
    }
}
