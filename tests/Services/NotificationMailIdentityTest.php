<?php

namespace BitApps\BitConnect\Tests\Services;

use BitApps\BitConnect\Enum\NotificationSettings;
use PHPUnit\Framework\TestCase;

/**
 * Who forum email comes from, and what it says around the list.
 *
 * This plugin sends as the site, with its own wording, and holds no setting for
 * either. That is the contract these tests pin, and it replaced a gate: the
 * fields used to be stored here and read back only when a licence agreed, which
 * is a built-in feature held behind payment and what WordPress.org guideline 5
 * forbids.
 *
 * The difference is visible in the first test. A settings blob carrying a
 * custom sender is not "ignored because unlicensed" — it is ignored because
 * nothing here reads it. Choosing a sender is the add-on's feature, it stores
 * it in its own option, and it arrives through the three filters below.
 *
 * Digest cadence is deliberately *not* in here. It never was a pro feature in
 * practice — members have always chosen their own and the hourly cron has
 * always batched — so NotificationSettingsTest covers it as ordinary behaviour.
 *
 * @internal
 *
 * @coversNothing
 */
final class NotificationMailIdentityTest extends TestCase
{
    /**
     * A settings blob carrying the keys the option used to hold.
     *
     * Kept deliberately: sites that ran an older build still have these rows,
     * and the point is that they no longer do anything.
     */
    private const LEGACY = [
        'fromName'        => 'The Forum Team',
        'fromEmail'       => 'forum@example.com',
        'mailGreeting'    => 'Hi {name}!',
        'mailIntro'       => 'Some things happened:',
        'mailDigestIntro' => 'Your week:',
        'mailFooter'      => 'Manage your email here:',
    ];

    protected function setUp(): void
    {
        $GLOBALS['__wp_bloginfo'] = ['name' => 'Bit Flows Forum'];
        $GLOBALS['__wp_home_url'] = 'https://forum.example.com';
        $GLOBALS['__wp_options'] = [];
        $GLOBALS['__wp_filters'] = [];
    }

    protected function tearDown(): void
    {
        $GLOBALS['__wp_options'] = [];
        $GLOBALS['__wp_filters'] = [];
    }

    public function testTheForumSendsAsTheSiteWhenNothingSuppliesASender(): void
    {
        $this->assertSame('Bit Flows Forum', NotificationSettings::fromName(self::LEGACY));
        $this->assertSame('wordpress@forum.example.com', NotificationSettings::fromEmail(self::LEGACY));
    }

    public function testTheForumUsesItsOwnWordingWhenNothingSuppliesAny(): void
    {
        $this->assertSame('Hello {name},', NotificationSettings::mailGreeting(self::LEGACY));
        $this->assertSame('Here is what happened:', NotificationSettings::mailIntro(self::LEGACY));
        $this->assertSame('Here is what you missed:', NotificationSettings::mailDigestIntro(self::LEGACY));
    }

    public function testASuppliedSenderIsUsed(): void
    {
        $GLOBALS['__wp_filters']['bit_connect_mail_from_name'] = 'The Forum Team';
        $GLOBALS['__wp_filters']['bit_connect_mail_from_email'] = 'forum@example.com';

        $this->assertSame('The Forum Team', NotificationSettings::fromName([]));
        $this->assertSame('forum@example.com', NotificationSettings::fromEmail([]));
    }

    public function testSuppliedWordingIsUsedPerLine(): void
    {
        // A callable, not a fixed value: the filter is asked for one line at a
        // time and has to answer differently depending on which.
        $GLOBALS['__wp_filters']['bit_connect_mail_template'] = static fn ($line, $key) => $key === 'mailGreeting'
            ? 'Hi {name}!'
            : $line;

        $this->assertSame('Hi {name}!', NotificationSettings::mailGreeting([]));
        // Untouched, because the listener handed this one straight back.
        $this->assertSame('Here is what happened:', NotificationSettings::mailIntro([]));
    }

    /**
     * A listener that answers with nothing does not produce an empty email.
     *
     * The old stored-field version had the same guard and it is worth keeping:
     * a blank greeting reads as the forum being broken, not as a choice.
     */
    public function testABlankAnswerFallsBackToTheBuiltInValue(): void
    {
        $GLOBALS['__wp_filters']['bit_connect_mail_from_name'] = '   ';
        $GLOBALS['__wp_filters']['bit_connect_mail_template'] = '';

        $this->assertSame('Bit Flows Forum', NotificationSettings::fromName([]));
        $this->assertSame('Hello {name},', NotificationSettings::mailGreeting([]));
    }

    /**
     * An address that is not deliverable is worse than the default one.
     */
    public function testAnInvalidSuppliedAddressIsIgnored(): void
    {
        $GLOBALS['__wp_filters']['bit_connect_mail_from_email'] = 'not-an-address';

        $this->assertSame('wordpress@forum.example.com', NotificationSettings::fromEmail([]));
    }

    /**
     * The screen is shown what will really be sent.
     */
    public function testTheAdminScreenIsShownTheResolvedValues(): void
    {
        $GLOBALS['__wp_filters']['bit_connect_mail_from_name'] = 'The Forum Team';

        $normalised = NotificationSettings::normalize(self::LEGACY);

        $this->assertSame('The Forum Team', $normalised['fromName']);
        $this->assertSame('Hello {name},', $normalised['mailGreeting']);
    }
}
