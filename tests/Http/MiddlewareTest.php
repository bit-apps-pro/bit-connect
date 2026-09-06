<?php

namespace BitApps\BitConnect\Tests\Http;

use BitApps\BitConnect\Config;
use BitApps\BitConnect\Deps\BitApps\WPKit\Http\Request\Request;
use BitApps\BitConnect\Deps\BitApps\WPKit\Http\Response;
use BitApps\BitConnect\Enum\Capabilities;
use BitApps\BitConnect\Http\Middleware\AdminCheckerMiddleware;
use BitApps\BitConnect\Http\Middleware\LoggedInMiddleware;
use BitApps\BitConnect\Http\Middleware\NonceCheckerMiddleware;
use PHPUnit\Framework\TestCase;

/**
 * The three gates every admin route passes through.
 *
 * A middleware that answers `true` too readily is the quietest failure in the
 * plugin: nothing breaks, no error is logged, and the route simply runs for
 * somebody who should never have reached it. Each of these tests is the
 * negative case — that the gate actually refuses — with the positive one beside
 * it so the gate is not simply broken shut.
 *
 * @internal
 *
 * @coversNothing
 */
final class MiddlewareTest extends TestCase
{
    protected function tearDown(): void
    {
        $GLOBALS['__wp_caps'] = [];
        $GLOBALS['__wp_current_user_id'] = 0;

        unset($GLOBALS['__wp_valid_nonce'], $GLOBALS['__wp_valid_nonce_action']);
    }

    // -----------------------------------------------------------------------
    // Who may reach the admin routes
    // -----------------------------------------------------------------------

    public function testSomeoneWhoManagesTheForumIsLetThrough(): void
    {
        $GLOBALS['__wp_caps'] = [Capabilities::MANAGE->value => true];

        $this->assertTrue((new AdminCheckerMiddleware())->handle());
    }

    public function testAnOrdinaryMemberIsRefused(): void
    {
        $GLOBALS['__wp_caps'] = [Capabilities::CREATE_POST->value => true];

        $this->assertNotTrue((new AdminCheckerMiddleware())->handle());
    }

    public function testALoggedOutVisitorIsRefused(): void
    {
        $this->assertNotTrue((new AdminCheckerMiddleware())->handle());
    }

    /**
     * The refusal has to carry a status, or the client reads a failure as a
     * success with an odd body.
     */
    public function testARefusalCarriesAnErrorStatusAndSaysWhy(): void
    {
        (new AdminCheckerMiddleware())->handle();

        $this->assertSame(Response::ERROR, Response::getStatus());
        $this->assertStringContainsString('Access Denied', (string) Response::getData());
    }

    /**
     * WordPress's own administrator capability is not the forum's. An admin who
     * has had forum_manage taken away in Manager has had it taken away.
     */
    public function testCoresAdministratorCapabilityIsNotTheForumsOwn(): void
    {
        $GLOBALS['__wp_caps'] = ['manage_options' => true];

        $this->assertNotTrue((new AdminCheckerMiddleware())->handle());
    }

    // -----------------------------------------------------------------------
    // Who may reach the member routes
    // -----------------------------------------------------------------------

    public function testASignedInMemberIsLetThrough(): void
    {
        $GLOBALS['__wp_current_user_id'] = 3;

        $this->assertTrue((new LoggedInMiddleware())->handle());
    }

    public function testAVisitorWhoIsNotSignedInIsRefused(): void
    {
        $GLOBALS['__wp_current_user_id'] = 0;

        $this->assertNotTrue((new LoggedInMiddleware())->handle());
        $this->assertSame(Response::ERROR, Response::getStatus());
    }

    /**
     * Authentication-agnostic on purpose: it asks only whether somebody is
     * signed in, so a site authenticating through WooCommerce or BuddyPress
     * works without this knowing about either.
     */
    public function testItAsksOnlyWhetherSomebodyIsSignedInAndNotHow(): void
    {
        $GLOBALS['__wp_current_user_id'] = 3;
        $GLOBALS['__wp_caps'] = [];

        $this->assertTrue((new LoggedInMiddleware())->handle());
    }

    // -----------------------------------------------------------------------
    // The nonce
    // -----------------------------------------------------------------------

    public function testARequestCarryingTheForumsOwnNonceIsLetThrough(): void
    {
        $this->issueNonce('good-token', Config::withPrefix('nonce'));

        $this->assertTrue((new NonceCheckerMiddleware())->handle($this->requestWith(['_ajax_nonce' => 'good-token'])));
    }

    public function testARequestWithNoNonceAtAllIsRefused(): void
    {
        $this->issueNonce('good-token', Config::withPrefix('nonce'));

        $this->assertNotTrue((new NonceCheckerMiddleware())->handle($this->requestWith([])));
    }

    public function testARequestWithAWrongNonceIsRefused(): void
    {
        $this->issueNonce('good-token', Config::withPrefix('nonce'));

        $this->assertNotTrue((new NonceCheckerMiddleware())->handle($this->requestWith(['_ajax_nonce' => 'guessed'])));
    }

    /**
     * A nonce is bound to the action it was issued for. One minted for another
     * plugin's form is a valid nonce and still not this one.
     */
    public function testANonceIssuedForSomethingElseIsRefused(): void
    {
        $this->issueNonce('good-token', 'some_other_plugin_action');

        $this->assertNotTrue((new NonceCheckerMiddleware())->handle($this->requestWith(['_ajax_nonce' => 'good-token'])));
    }

    public function testAnEmptyNonceIsRefused(): void
    {
        $this->issueNonce('good-token', Config::withPrefix('nonce'));

        $this->assertNotTrue((new NonceCheckerMiddleware())->handle($this->requestWith(['_ajax_nonce' => ''])));
    }

    // -----------------------------------------------------------------------
    // Helpers
    // -----------------------------------------------------------------------

    private function issueNonce(string $token, string $action): void
    {
        $GLOBALS['__wp_valid_nonce'] = $token;
        $GLOBALS['__wp_valid_nonce_action'] = $action;
    }

    /**
     * A Request carrying exactly these fields.
     *
     * Built without the real constructor, which reads the superglobals and the
     * REST route — neither of which exists here, and neither of which the
     * middleware looks at.
     *
     * @param array<string, mixed> $fields
     */
    private function requestWith(array $fields): Request
    {
        return new class($fields) extends Request {
            /** @var array<string, mixed> */
            private $fields;

            /**
             * @param array<string, mixed> $fields
             */
            public function __construct(array $fields)
            {
                $this->fields = $fields;
            }

            public function has($key)
            {
                return \array_key_exists($key, $this->fields);
            }

            public function __get($key)
            {
                return $this->fields[$key] ?? null;
            }
        };
    }
}
