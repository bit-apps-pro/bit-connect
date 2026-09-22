<?php

namespace BitApps\BitConnect\Tests\Services;

use BitApps\BitConnect\Services\AuthService;
use PHPUnit\Framework\TestCase;
use WP_Error;

/**
 * The forum's registration form asks the same plugins WordPress's own form
 * asks before it creates an account.
 *
 * register_new_user() fires `register_post` and then runs `registration_errors`,
 * and that pair is where anti-spam, captcha and security plugins hook in. A
 * form that skipped them would be a way around every one of those plugins on
 * the site, so AuthService::registrationErrors() has to fire the action and
 * honour the filter's answer exactly as core does.
 *
 * @internal
 *
 * @coversNothing
 */
final class RegistrationGateTest extends TestCase
{
    protected function setUp(): void
    {
        $GLOBALS['__wp_filters'] = [];
        $GLOBALS['__wp_actions_fired'] = [];
    }

    protected function tearDown(): void
    {
        $GLOBALS['__wp_filters'] = [];
        $GLOBALS['__wp_actions_fired'] = [];
    }

    public function testNothingObjectsOnASiteWithNoRegistrationGuards(): void
    {
        $this->assertNull(AuthService::registrationErrors('amara', 'amara@example.com'));
    }

    public function testThePluginsOnRegistrationErrorsCanRefuseARegistration(): void
    {
        $GLOBALS['__wp_filters']['registration_errors'] = static function (WP_Error $errors, string $login, string $email) {
            return new WP_Error('captcha_failed', 'Please complete the captcha.');
        };

        $refused = AuthService::registrationErrors('amara', 'amara@example.com');

        $this->assertInstanceOf(WP_Error::class, $refused);
        $this->assertSame('captcha_failed', $refused->get_error_code());
        $this->assertSame('Please complete the captcha.', $refused->get_error_message());
    }

    /**
     * A filter that hands the WP_Error back untouched has not objected, however
     * many plugins it passed through.
     */
    public function testAFilterThatAddsNothingIsNotAnObjection(): void
    {
        $GLOBALS['__wp_filters']['registration_errors'] = static fn (WP_Error $errors) => $errors;

        $this->assertNull(AuthService::registrationErrors('amara', 'amara@example.com'));
    }

    /**
     * The gate is handed the login and the email the account would be created
     * with, in core's order, so a plugin written against wp-login.php reads the
     * same arguments here.
     */
    public function testTheGateSeesTheLoginAndEmailInCoreOrder(): void
    {
        $seen = [];

        $GLOBALS['__wp_filters']['registration_errors'] = static function (WP_Error $errors, string $login, string $email) use (&$seen) {
            $seen = [$login, $email];

            return $errors;
        };

        AuthService::registrationErrors('amara', 'amara@example.com');

        $this->assertSame(['amara', 'amara@example.com'], $seen);
    }

    public function testRegisterPostFiresBeforeTheFilterWithTheSameArguments(): void
    {
        AuthService::registrationErrors('amara', 'amara@example.com');

        $fired = array_values(array_filter(
            $GLOBALS['__wp_actions_fired'],
            static fn (array $event) => $event['tag'] === 'register_post'
        ));

        $this->assertCount(1, $fired);
        $this->assertSame('amara', $fired[0]['args'][0]);
        $this->assertSame('amara@example.com', $fired[0]['args'][1]);
        $this->assertInstanceOf(WP_Error::class, $fired[0]['args'][2]);
    }
}
