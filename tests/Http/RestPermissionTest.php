<?php

namespace BitApps\BitConnect\Tests\Http;

use BitApps\BitConnect\Deps\BitApps\WPKit\Http\Request\Request;
use BitApps\BitConnect\Http\Controller\LoginController;
use BitApps\BitConnect\Http\Controller\TopicController;
use BitApps\BitConnect\Http\Requests\CreateTopicRequest;
use BitApps\BitConnect\Http\RestPermission;
use PHPUnit\Framework\TestCase;
use WP_Error;
use WP_REST_Request;

/**
 * A Request whose answer the test decides.
 */
final class DecidedRequest extends Request
{
    public static bool $allowed = false;

    public static array $seen = [];

    public function authorize()
    {
        self::$seen = (array) $this->attributes;

        return self::$allowed;
    }

    public function failedAuthorizationMessage(): string
    {
        return 'Decided against.';
    }
}

final class DecidedController
{
    public function act(DecidedRequest $request): void {}

    public function open(): void {}
}

/**
 * Every route this plugin registers answers its `permission_callback`
 * with the same `authorize()` the router runs inside the action, so the
 * route table never says "public" about a route that is not.
 *
 * @internal
 *
 * @coversNothing
 */
final class RestPermissionTest extends TestCase
{
    protected function setUp(): void
    {
        DecidedRequest::$allowed = false;
        DecidedRequest::$seen = [];
        $GLOBALS['__wp_current_user_id'] = 0;
    }

    public function testFindsTheRequestClassAnActionTakes(): void
    {
        $this->assertSame(
            CreateTopicRequest::class,
            RestPermission::requestClassOf([TopicController::class, 'create'])
        );
    }

    public function testAnActionWithoutARequestIsPublicByDeclaration(): void
    {
        $this->assertNull(RestPermission::requestClassOf([LoginController::class, 'data']));
        $this->assertTrue((new RestPermission([DecidedController::class, 'open']))->check(new WP_REST_Request()));
    }

    public function testAllowsWhenTheRequestAuthorizes(): void
    {
        DecidedRequest::$allowed = true;

        $permission = new RestPermission([DecidedController::class, 'act']);

        $this->assertTrue($permission->check(new WP_REST_Request(['title' => 'x'], ['id' => '7'])));
        // The Request saw the incoming REST request, not the PHP globals.
        $this->assertSame('7', DecidedRequest::$seen['id']);
        $this->assertSame('x', DecidedRequest::$seen['title']);
    }

    public function testRefusesWithTheRequestsOwnMessageAnd401WhenLoggedOut(): void
    {
        $permission = new RestPermission([DecidedController::class, 'act']);

        $result = $permission->check(new WP_REST_Request());

        $this->assertInstanceOf(WP_Error::class, $result);
        $this->assertSame('rest_forbidden', $result->get_error_code());
        $this->assertSame('Decided against.', $result->get_error_message());
    }

    public function testRefusesWith403WhenLoggedIn(): void
    {
        $GLOBALS['__wp_current_user_id'] = 3;

        $result = (new RestPermission([DecidedController::class, 'act']))->check(new WP_REST_Request());

        $this->assertInstanceOf(WP_Error::class, $result);
    }

    public function testOnlyThisPluginsRoutesAreTouched(): void
    {
        $foreign = ['/wp/v2/posts' => [['callback' => '__return_true', 'permission_callback' => '__return_true']]];

        $this->assertSame($foreign, RestPermission::attach($foreign));
        $this->assertSame('not an array', RestPermission::attach('not an array'));
    }
}
