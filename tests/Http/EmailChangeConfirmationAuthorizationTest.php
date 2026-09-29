<?php

namespace BitApps\BitConnect\Tests\Http;

use BitApps\BitConnect\Http\Controller\AccountSecurityController;
use BitApps\BitConnect\Http\RestPermission;
use PHPUnit\Framework\TestCase;
use WP_Error;
use WP_REST_Request;

/**
 * The email-change confirmation link is honoured only for the signed-in owner,
 * the way core's `_new_email` flow is. Holding the token is not enough: a
 * mistyped address puts the link in a stranger's inbox, and letting them
 * confirm it would hand them the account through a password reset.
 *
 * @internal
 *
 * @coversNothing
 */
final class EmailChangeConfirmationAuthorizationTest extends TestCase
{
    protected function setUp(): void
    {
        $GLOBALS['__wp_current_user_id'] = 0;
    }

    public function testASignedOutVisitorIsAskedToSignIn(): void
    {
        $result = self::permission()->check(self::confirmation(1));

        $this->assertInstanceOf(WP_Error::class, $result);
        $this->assertSame('Please sign in to confirm your new email address.', $result->get_error_message());
    }

    public function testAnotherSignedInMemberIsRefused(): void
    {
        $GLOBALS['__wp_current_user_id'] = 2;

        $result = self::permission()->check(self::confirmation(1));

        $this->assertInstanceOf(WP_Error::class, $result);
        $this->assertSame('This confirmation link belongs to a different account.', $result->get_error_message());
    }

    public function testTheOwnerMayConfirm(): void
    {
        $GLOBALS['__wp_current_user_id'] = 1;

        $this->assertTrue(self::permission()->check(self::confirmation(1)));
    }

    private static function permission(): RestPermission
    {
        return new RestPermission([AccountSecurityController::class, 'confirmEmailChange']);
    }

    private static function confirmation(int $userId): WP_REST_Request
    {
        return new WP_REST_Request(['token' => str_repeat('a', 48), 'user_id' => (string) $userId]);
    }
}
