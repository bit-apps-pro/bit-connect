<?php

namespace BitApps\BitConnect\Tests\Services;

use BitApps\BitConnect\Services\AuthService;
use PHPUnit\Framework\TestCase;

/**
 * Pins where a registration waits for its verification link.
 *
 * It is an option, not a transient: on a site with Redis or Memcached a
 * transient lives only in memory, which drops entries when it runs short, and
 * the member's link then said it had expired the moment they opened it.
 *
 * @internal
 *
 * @coversNothing
 */
final class PendingRegistrationTest extends TestCase
{
    private const PREFIX = 'bit_connect_pending_registration_';

    private const DATA = ['user_login' => 'ada', 'user_email' => 'ada@example.com', 'password_hash' => 'hash'];

    protected function setUp(): void
    {
        $GLOBALS['__wp_options'] = [];
        $GLOBALS['__wp_transients'] = [];
    }

    protected function tearDown(): void
    {
        $GLOBALS['__wp_options'] = [];
        $GLOBALS['__wp_transients'] = [];
    }

    public function testARegistrationWaitsInAnOptionNotATransient(): void
    {
        AuthService::storePendingAndSendVerification(self::DATA, 'ada@example.com');

        $entry = $GLOBALS['__wp_options'][self::PREFIX . $this->token()];

        $this->assertSame(self::DATA, $entry['data']);
        $this->assertGreaterThan(time(), $entry['expires']);
        $this->assertSame([], $GLOBALS['__wp_transients']);
    }

    public function testTheLinkWorksOnce(): void
    {
        AuthService::storePendingAndSendVerification(self::DATA, 'ada@example.com');
        $token = $this->token();

        $this->assertSame(self::DATA, AuthService::getPendingRegistration($token));
        $this->assertNull(AuthService::getPendingRegistration($token));
    }

    public function testAnExpiredLinkIsRefusedAndRemoved(): void
    {
        $GLOBALS['__wp_options'][self::PREFIX . 'old'] = ['data' => self::DATA, 'expires' => time() - 1];

        $this->assertNull(AuthService::getPendingRegistration('old'));
        $this->assertArrayNotHasKey(self::PREFIX . 'old', $GLOBALS['__wp_options']);
    }

    /**
     * A link mailed before the update was parked as a transient.
     */
    public function testALinkMailedBeforeTheUpdateStillWorksOnce(): void
    {
        $GLOBALS['__wp_transients']['bit_connect_pending_reg_legacy'] = self::DATA;

        $this->assertSame(self::DATA, AuthService::getPendingRegistration('legacy'));
        $this->assertNull(AuthService::getPendingRegistration('legacy'));
    }

    public function testAnUnknownTokenIsRefused(): void
    {
        $this->assertNull(AuthService::getPendingRegistration('nothing-here'));
    }

    private function token(): string
    {
        foreach (array_keys($GLOBALS['__wp_options']) as $name) {
            if (str_starts_with($name, self::PREFIX)) {
                return substr($name, \strlen(self::PREFIX));
            }
        }

        $this->fail('No registration was parked.');
    }
}
