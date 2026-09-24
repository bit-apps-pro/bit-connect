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
    use PHPUnit\Framework\TestCase;

    class AjaxTest extends TestCase
    {
        protected function setUp(): void
        {
            Route::reset();
            require __DIR__ . '/../../backend/hooks/ajax.php';
        }

        public function testRegistersExactlyOneRoute(): void
        {
            $this->assertCount(1, Route::$registered);
        }

        public function testRegistersLoginRoute(): void
        {
            $this->assertContains(
                ['method' => 'post', 'path' => 'ajax_login', 'action' => [LoginController::class, 'login']],
                Route::$registered
            );
        }

        /**
         * Logging out is a REST route (`auth/logout`) under core's cookie and
         * nonce check; the AJAX file carries no logout of its own.
         */
        public function testRegistersNoLogoutRoute(): void
        {
            $paths = array_column(Route::$registered, 'path');

            $this->assertNotContains('ajax_logout', $paths);
        }

        /**
         * The login route stays open on purpose: a guest signing in has no
         * session to check, and AjaxLoginRequest verifies its nonce.
         * Everything else added here must not be.
         */
        public function testOnlyTheLoginRouteIsUnguarded(): void
        {
            $unguarded = [];

            foreach (Route::$registered as $route) {
                $key = $route['method'] . ' ' . $route['path'];

                if (empty(Route::$middleware[$key])) {
                    $unguarded[] = $route['path'];
                }
            }

            sort($unguarded);

            $this->assertSame(['ajax_login'], $unguarded);
        }
    }
}
