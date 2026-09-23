<?php

namespace BitApps\BitConnect\Http;

// Prevent direct script access
if (!defined('ABSPATH')) {
    exit;
}

use BitApps\BitConnect\Config;
use BitApps\BitConnect\Deps\BitApps\WPKit\Hooks\Hooks;
use BitApps\BitConnect\Deps\BitApps\WPKit\Http\Request\Request;
use BitApps\BitConnect\Deps\BitApps\WPKit\Http\Router\RouteRegister;
use ReflectionMethod;
use ReflectionNamedType;
use WP_Error;
use WP_REST_Request;

/**
 * The `permission_callback` of every route this plugin registers.
 *
 * The router registers each route with `__return_true` and runs the action's
 * Request class — its `authorize()` — inside the callback. That is a real
 * gate, but it sits behind a callback that says "always allowed", which is not
 * where WordPress expects to find the answer: `rest_pre_dispatch` listeners,
 * the REST index and anyone reading the route table see a public route.
 *
 * This puts the same answer where it belongs. For each of this plugin's
 * routes the permission callback reflects the action, finds the Request the
 * action takes, and asks that Request's `authorize()` with the incoming
 * WP_REST_Request bound. A route whose action takes no Request is public by
 * declaration — the auth bootstrap, for instance — and stays so.
 *
 * The router still runs `authorize()` again inside the callback. That is
 * cheap, and it keeps the two answers from ever disagreeing: the Request
 * class is the single place a route's access rule is written.
 */
final class RestPermission
{
    /**
     * The controller and method the route runs.
     *
     * @var array{0: class-string, 1: string}
     */
    private array $action;

    /**
     * The router's registration for this route, which the Request binds to.
     */
    private ?RouteRegister $route;

    /**
     * Holds the action to reflect and the route the Request is built against.
     *
     * @param array{0: class-string, 1: string} $action
     */
    public function __construct(array $action, ?RouteRegister $route = null)
    {
        $this->action = $action;
        $this->route = $route;
    }

    public static function register(): void
    {
        Hooks::addFilter('rest_endpoints', [self::class, 'attach']);
    }

    /**
     * Replace `__return_true` with a real check on every route in this
     * plugin's namespace.
     *
     * @param mixed $endpoints
     *
     * @return mixed
     */
    public static function attach($endpoints)
    {
        if (!\is_array($endpoints)) {
            return $endpoints;
        }

        $prefix = '/' . Config::SLUG . '/';

        foreach ($endpoints as $route => $handlers) {
            if (!\is_string($route) || !\is_array($handlers) || strpos($route, $prefix) !== 0) {
                continue;
            }

            foreach ($handlers as $index => $handler) {
                if (!\is_int($index) || !\is_array($handler)) {
                    continue;
                }

                $action = self::actionOf($handler['callback'] ?? null);

                if ($action === null) {
                    continue;
                }

                $endpoints[$route][$index]['permission_callback'] = [new self($action, $handler['callback'][0]), 'check'];
            }
        }

        return $endpoints;
    }

    /**
     * Whether the caller may run this route.
     *
     * @return true|WP_Error
     */
    public function check(WP_REST_Request $request)
    {
        $requestClass = self::requestClassOf($this->action);

        // No Request class means the route declares itself public: there is
        // nothing to ask. RouteAuthorizationTest keeps that list short and
        // deliberate.
        if ($requestClass === null) {
            return true;
        }

        // Built against the same registration the router uses, so the url
        // parameters the REST request carries land where authorize() reads them.
        $formRequest = new $requestClass($this->route);
        $formRequest->setApiRequest($request);

        if (!method_exists($formRequest, 'authorize') || $formRequest->authorize()) {
            return true;
        }

        $message = method_exists($formRequest, 'failedAuthorizationMessage')
            ? (string) $formRequest->failedAuthorizationMessage()
            : __('You are not authorized to access this endpoint.', 'bit-connect');

        return new WP_Error(
            'rest_forbidden',
            $message,
            ['status' => is_user_logged_in() ? 403 : 401]
        );
    }

    /**
     * The Request class an action takes, or null when it takes none.
     *
     * @param array{0: class-string, 1: string} $action
     *
     * @return null|class-string<Request>
     */
    public static function requestClassOf(array $action): ?string
    {
        [$controller, $method] = $action;

        if (!method_exists($controller, $method)) {
            return null;
        }

        $reflection = new ReflectionMethod($controller, $method);

        foreach ($reflection->getParameters() as $parameter) {
            $type = $parameter->getType();

            if (!$type instanceof ReflectionNamedType || $type->isBuiltin()) {
                continue;
            }

            $name = $type->getName();

            if ($name === Request::class || is_subclass_of($name, Request::class)) {
                return $name;
            }
        }

        return null;
    }

    /**
     * The controller action behind a registered callback, or null when the
     * callback is not one of the router's.
     *
     * @param mixed $callback
     *
     * @return null|array{0: class-string, 1: string}
     */
    private static function actionOf($callback): ?array
    {
        if (!\is_array($callback) || !($callback[0] ?? null) instanceof RouteRegister) {
            return null;
        }

        $action = $callback[0]->getAction();

        if (!\is_array($action) || \count($action) !== 2 || !\is_string($action[0]) || !\is_string($action[1])) {
            return null;
        }

        return [$action[0], $action[1]];
    }
}
