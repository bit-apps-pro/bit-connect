<?php

namespace BitApps\BitConnect\Tests\Services;

use BitApps\BitConnect\Services\EmailChangeService;
use PHPUnit\Framework\TestCase;
use WP_User;

class EmailChangeServiceTest extends TestCase
{
    protected function setUp(): void
    {
        $GLOBALS['__wp_users'] = [];
        $GLOBALS['__wp_user_meta'] = [];
        $GLOBALS['__wp_actions'] = [];
        $GLOBALS['__wp_options'] = [];
        $GLOBALS['__wp_mail'] = [];

        $this->seedUser(1, 'aiden@example.com');
    }

    // -------------------------------------------------------------------------
    // Requesting
    // -------------------------------------------------------------------------

    public function testParksTheAddressWithoutApplyingIt(): void
    {
        $this->assertTrue(EmailChangeService::requestChange(1, 'new@example.com'));

        // The point of the flow: nothing moves until the link is opened.
        $this->assertSame('aiden@example.com', get_userdata(1)->user_email);
        $this->assertSame('new@example.com', EmailChangeService::pendingEmail(1));
    }

    public function testEmailsTheNewAddressNotTheCurrentOne(): void
    {
        EmailChangeService::requestChange(1, 'new@example.com');

        $this->assertCount(1, $GLOBALS['__wp_mail']);
        $this->assertSame('new@example.com', $GLOBALS['__wp_mail'][0]['to']);
        $this->assertStringContainsString('bc_email_token=', $GLOBALS['__wp_mail'][0]['message']);
        $this->assertStringContainsString('bc_uid=1', $GLOBALS['__wp_mail'][0]['message']);
    }

    public function testRejectsAnInvalidAddress(): void
    {
        $result = EmailChangeService::requestChange(1, 'not-an-email');

        $this->assertInstanceOf(\WP_Error::class, $result);
        $this->assertSame('invalid_email', $result->get_error_code());
        $this->assertSame([], $GLOBALS['__wp_mail']);
    }

    public function testRejectsTheAddressTheyAlreadyHave(): void
    {
        $result = EmailChangeService::requestChange(1, 'AIDEN@example.com');

        $this->assertInstanceOf(\WP_Error::class, $result);
        $this->assertSame('email_unchanged', $result->get_error_code());
    }

    public function testRejectsAnAddressAnotherMemberHas(): void
    {
        $this->seedUser(2, 'taken@example.com');

        $result = EmailChangeService::requestChange(1, 'taken@example.com');

        $this->assertInstanceOf(\WP_Error::class, $result);
        $this->assertSame('email_taken', $result->get_error_code());
    }

    public function testAskingAgainReplacesTheEarlierRequest(): void
    {
        EmailChangeService::requestChange(1, 'typo@example.com');
        $firstToken = $GLOBALS['__wp_user_meta'][1]['bit_connect_email_change_token'];

        EmailChangeService::requestChange(1, 'correct@example.com');

        $this->assertSame('correct@example.com', EmailChangeService::pendingEmail(1));
        // The typo'd request is dead: its address is gone, so even a valid
        // token cannot resurrect it.
        $this->assertInstanceOf(\WP_Error::class, EmailChangeService::confirm(1, $firstToken . 'x'));
    }

    // -------------------------------------------------------------------------
    // Confirming
    // -------------------------------------------------------------------------

    public function testAppliesTheAddressOnConfirmation(): void
    {
        EmailChangeService::requestChange(1, 'new@example.com');
        $token = $GLOBALS['__wp_user_meta'][1]['bit_connect_email_change_token'];

        $user = EmailChangeService::confirm(1, $token);

        $this->assertInstanceOf(WP_User::class, $user);
        $this->assertSame('new@example.com', get_userdata(1)->user_email);
        $this->assertSame('', EmailChangeService::pendingEmail(1));
    }

    public function testATokenCannotBeSpentTwice(): void
    {
        EmailChangeService::requestChange(1, 'new@example.com');
        $token = $GLOBALS['__wp_user_meta'][1]['bit_connect_email_change_token'];

        EmailChangeService::confirm(1, $token);
        $second = EmailChangeService::confirm(1, $token);

        $this->assertInstanceOf(\WP_Error::class, $second);
        $this->assertSame('invalid_token', $second->get_error_code());
    }

    public function testRejectsTheWrongToken(): void
    {
        EmailChangeService::requestChange(1, 'new@example.com');

        $result = EmailChangeService::confirm(1, 'not-the-token');

        $this->assertInstanceOf(\WP_Error::class, $result);
        $this->assertSame('invalid_token', $result->get_error_code());
        $this->assertSame('aiden@example.com', get_userdata(1)->user_email);
    }

    public function testRejectsAnExpiredToken(): void
    {
        EmailChangeService::requestChange(1, 'new@example.com');
        $token = $GLOBALS['__wp_user_meta'][1]['bit_connect_email_change_token'];
        $GLOBALS['__wp_user_meta'][1]['bit_connect_email_change_expiry'] = time() - 1;

        $result = EmailChangeService::confirm(1, $token);

        $this->assertInstanceOf(\WP_Error::class, $result);
        $this->assertSame('token_expired', $result->get_error_code());
        $this->assertSame('aiden@example.com', get_userdata(1)->user_email);
        // Expired requests do not linger as a pending state on the settings form.
        $this->assertSame('', EmailChangeService::pendingEmail(1));
    }

    public function testRejectsAnAddressClaimedWhileTheLinkSatInAnInbox(): void
    {
        EmailChangeService::requestChange(1, 'new@example.com');
        $token = $GLOBALS['__wp_user_meta'][1]['bit_connect_email_change_token'];

        // Someone else registers it in the meantime.
        $this->seedUser(2, 'new@example.com');

        $result = EmailChangeService::confirm(1, $token);

        $this->assertInstanceOf(\WP_Error::class, $result);
        $this->assertSame('email_taken', $result->get_error_code());
        $this->assertSame('aiden@example.com', get_userdata(1)->user_email);
    }

    public function testConfirmingWithNothingPendingFails(): void
    {
        $result = EmailChangeService::confirm(1, 'anything');

        $this->assertInstanceOf(\WP_Error::class, $result);
        $this->assertSame('invalid_token', $result->get_error_code());
    }

    private function seedUser(int $id, string $email): void
    {
        $user = new WP_User();
        $user->ID = $id;
        $user->user_email = $email;
        $user->display_name = 'Member ' . $id;

        $GLOBALS['__wp_users'][$id] = $user;
    }
}
