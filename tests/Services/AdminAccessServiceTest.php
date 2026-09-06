<?php

namespace BitApps\BitConnect\Tests\Services;

use BitApps\BitConnect\Enum\Capabilities;
use BitApps\BitConnect\Services\AdminAccessService;
use PHPUnit\Framework\TestCase;

/**
 * Pins down who may open the Bit Connect admin menu.
 *
 * WordPress takes one capability string per menu entry and has no way to say
 * "forum_manage or forum_moderate", so this one is computed. Two failures
 * matter and neither is loud: a moderator locked out of a menu built for them,
 * or the derived capability being storable — which would make it a back door to
 * the menu for someone holding neither real capability.
 *
 * @internal
 *
 * @coversNothing
 */
final class AdminAccessServiceTest extends TestCase
{
    protected function tearDown(): void
    {
        $GLOBALS['__wp_caps'] = [];
        $GLOBALS['__wp_filter_callbacks'] = [];
    }

    public function testAManagerMayOpenTheMenu(): void
    {
        $granted = AdminAccessService::grant([Capabilities::MANAGE->value => true]);

        $this->assertTrue($granted[AdminAccessService::CAP]);
    }

    /**
     * The case the derived capability exists for: every screen under the menu
     * used to ask for forum_manage, which left a moderator-facing screen
     * unreachable however it was gated itself.
     */
    public function testAModeratorMayOpenTheMenu(): void
    {
        $granted = AdminAccessService::grant([Capabilities::MODERATE->value => true]);

        $this->assertTrue($granted[AdminAccessService::CAP]);
    }

    public function testSomeoneHoldingNeitherMayNot(): void
    {
        $granted = AdminAccessService::grant([Capabilities::CREATE_POST->value => true]);

        $this->assertFalse($granted[AdminAccessService::CAP]);
    }

    public function testAnEmptyCapabilitySetMayNot(): void
    {
        $this->assertFalse(AdminAccessService::grant([])[AdminAccessService::CAP]);
    }

    /**
     * Written on every pass rather than only when true, so a value stored
     * directly against a role or a user is always overwritten by the computed
     * one. Adding it only on the true branch would make it grantable.
     */
    public function testAStoredGrantIsOverwrittenRatherThanHonoured(): void
    {
        $granted = AdminAccessService::grant([AdminAccessService::CAP => true]);

        $this->assertFalse($granted[AdminAccessService::CAP]);
    }

    public function testAStoredDenialDoesNotSurviveEitherRealCapability(): void
    {
        $granted = AdminAccessService::grant(
            [
                AdminAccessService::CAP        => false,
                Capabilities::MODERATE->value => true,
            ]
        );

        $this->assertTrue($granted[AdminAccessService::CAP]);
    }

    public function testEveryOtherCapabilityIsPassedThroughUntouched(): void
    {
        $granted = AdminAccessService::grant(
            [
                Capabilities::MANAGE->value      => true,
                Capabilities::CREATE_POST->value => false,
                'edit_posts'                     => true,
            ]
        );

        $this->assertTrue($granted[Capabilities::MANAGE->value]);
        $this->assertFalse($granted[Capabilities::CREATE_POST->value]);
        $this->assertTrue($granted['edit_posts']);
    }

    /**
     * user_has_cap hands other things through on some installs; returning them
     * unchanged is what keeps this filter from breaking them.
     */
    public function testANonArrayIsHandedBackUnchanged(): void
    {
        $this->assertNull(AdminAccessService::grant(null));
        $this->assertSame('unexpected', AdminAccessService::grant('unexpected'));
    }

    /**
     * Not prefixed forum_* on purpose, so it cannot be mistaken for one of the
     * grantable capabilities in a settings array or a role dump.
     */
    public function testTheDerivedCapabilityIsNotNamedLikeAGrantableOne(): void
    {
        $this->assertSame('bit_connect_access_admin', AdminAccessService::CAP);
        $this->assertStringStartsNotWith('forum_', AdminAccessService::CAP);
    }

    public function testRegisteringHooksTheCapabilityOntoUserHasCap(): void
    {
        AdminAccessService::register();

        $this->assertContains(
            [AdminAccessService::class, 'grant'],
            $GLOBALS['__wp_filter_callbacks']['user_has_cap']
        );
    }

    public function testTheCurrentUserCheckAsksForTheDerivedCapability(): void
    {
        $GLOBALS['__wp_caps'] = [AdminAccessService::CAP => true];
        $this->assertTrue(AdminAccessService::currentUserCan());

        $GLOBALS['__wp_caps'] = [Capabilities::MANAGE->value => true];
        $this->assertFalse(AdminAccessService::currentUserCan());
    }
}
