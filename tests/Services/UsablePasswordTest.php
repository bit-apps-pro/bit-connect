<?php

namespace BitApps\BitConnect\Tests\Services;

use BitApps\BitConnect\Services\AuthService;
use PHPUnit\Framework\TestCase;
use WP_User;

/**
 * Accounts an SSO or social-login plugin created may have no password at all.
 * Telling those apart from ordinary accounts is what stops the settings form
 * asking for a password its owner has never had.
 */
class UsablePasswordTest extends TestCase
{
    protected function setUp(): void
    {
        $GLOBALS['__wp_users'] = [];
    }

    public function testAnAccountWithAStoredHashHasAUsablePassword(): void
    {
        $this->seedUser(1, 'hashed:correct-horse');

        $this->assertTrue(AuthService::hasUsablePassword(1));
    }

    public function testAnAccountWithNoStoredHashDoesNot(): void
    {
        $this->seedUser(1, '');

        $this->assertFalse(AuthService::hasUsablePassword(1));
    }

    public function testWhitespaceIsNotAPassword(): void
    {
        $this->seedUser(1, '   ');

        $this->assertFalse(AuthService::hasUsablePassword(1));
    }

    public function testAMissingUserHasNoUsablePassword(): void
    {
        $this->assertFalse(AuthService::hasUsablePassword(999));
    }

    public function testAnEmptyHashMatchesNothingAtAll(): void
    {
        // The reason the flag has to exist. An empty user_pass is not a password
        // of "" — it cannot be satisfied by any input, so a member holding one
        // could never answer a "current password" prompt and would be locked out
        // of ever setting one.
        $this->assertFalse(wp_check_password('', '', 1));
        $this->assertFalse(wp_check_password('anything', '', 1));
    }

    public function testAGeneratedPasswordIsIndistinguishableFromAChosenOne(): void
    {
        // The case this check cannot cover: an SSO plugin that created the
        // account with a random password leaves a hash like any other, so the
        // member is offered the reset link instead.
        $this->seedUser(1, 'hashed:' . str_repeat('x', 24));

        $this->assertTrue(AuthService::hasUsablePassword(1));
    }

    private function seedUser(int $id, string $passwordHash): void
    {
        $user = new WP_User();
        $user->ID = $id;
        $user->user_login = 'member' . $id;
        $user->user_pass = $passwordHash;

        $GLOBALS['__wp_users'][$id] = $user;
    }
}
