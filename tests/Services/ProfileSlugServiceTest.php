<?php

namespace BitApps\BitConnect\Tests\Services;

use BitApps\BitConnect\Services\ProfileSlugService;
use PHPUnit\Framework\TestCase;
use WP_User;

class ProfileSlugServiceTest extends TestCase
{
    protected function setUp(): void
    {
        $GLOBALS['__wp_users'] = [];
        $GLOBALS['__wp_user_meta'] = [];
        $GLOBALS['__wp_actions'] = [];

        // The real plugin registers these in the hook provider; wp_update_user()
        // in the bootstrap fires profile_update, which is what makes the
        // display-name/slug interaction observable.
        ProfileSlugService::registerHooks();
    }

    // -------------------------------------------------------------------------
    // Validation
    // -------------------------------------------------------------------------

    public function testRejectsSlugsThatNormaliseToNothing(): void
    {
        $this->assertNotNull(ProfileSlugService::validateSlug('!!!', 1));
        $this->assertNotNull(ProfileSlugService::validateSlug('', 1));
    }

    public function testRejectsSlugsOutsideTheLengthBounds(): void
    {
        $this->assertNotNull(ProfileSlugService::validateSlug('ab', 1));
        $this->assertNotNull(ProfileSlugService::validateSlug(str_repeat('a', 61), 1));

        $this->assertNull(ProfileSlugService::validateSlug('abc', 1));
        $this->assertNull(ProfileSlugService::validateSlug(str_repeat('a', 60), 1));
    }

    public function testRejectsAnAllNumericSlug(): void
    {
        // Would be indistinguishable from a user id, which resolveId() accepts.
        $this->assertNotNull(ProfileSlugService::validateSlug('12345', 1));
    }

    public function testRejectsReservedSlugs(): void
    {
        foreach (['admin', 'login', 'settings', 'user', 'users', 'wp-admin'] as $reserved) {
            $this->assertNotNull(
                ProfileSlugService::validateSlug($reserved, 1),
                sprintf('"%s" should be reserved', $reserved)
            );
        }
    }

    public function testRejectsASlugAnotherMemberAlreadyHas(): void
    {
        $this->seedUser(1, 'Aiden Carter');
        ProfileSlugService::slugFor(1);

        $this->assertNotNull(ProfileSlugService::validateSlug('aiden-carter', 2));
        // The owner does not clash with themselves.
        $this->assertNull(ProfileSlugService::validateSlug('aiden-carter', 1));
    }

    public function testRejectsASlugAnotherMemberRetired(): void
    {
        $this->seedUser(1, 'Aiden Carter');
        ProfileSlugService::slugFor(1);
        ProfileSlugService::setCustomSlug(1, 'ace');

        // aiden-carter is now an alias of user 1 and still resolves there, so
        // handing it to user 2 would hijack links already in the wild.
        $this->assertNotNull(ProfileSlugService::validateSlug('aiden-carter', 2));
    }

    public function testNormalisesBeforeValidating(): void
    {
        $this->assertSame('aiden-carter', ProfileSlugService::normalizeSlug('Aiden Carter'));
        $this->assertNull(ProfileSlugService::validateSlug('Aiden Carter', 1));
    }

    // -------------------------------------------------------------------------
    // Storage
    // -------------------------------------------------------------------------

    public function testDerivesASlugFromTheDisplayName(): void
    {
        $this->seedUser(1, 'Aiden Carter');

        $this->assertSame('aiden-carter', ProfileSlugService::slugFor(1));
    }

    public function testSuffixesAClashingDerivedSlug(): void
    {
        $this->seedUser(1, 'Aiden Carter');
        $this->seedUser(2, 'Aiden Carter');

        $this->assertSame('aiden-carter', ProfileSlugService::slugFor(1));
        $this->assertSame('aiden-carter-2', ProfileSlugService::slugFor(2));
    }

    public function testSettingACustomSlugRetiresThePreviousOneAsAnAlias(): void
    {
        $this->seedUser(1, 'Aiden Carter');
        ProfileSlugService::slugFor(1);

        ProfileSlugService::setCustomSlug(1, 'ace');

        $this->assertSame('ace', ProfileSlugService::slugFor(1));
        // The shared link still lands on the right profile.
        $this->assertSame(1, ProfileSlugService::resolve('aiden-carter'));
    }

    public function testACustomSlugSurvivesADisplayNameChange(): void
    {
        // The regression this guard exists for: wp_update_user() fires
        // profile_update, which syncUser() hooks, which would otherwise
        // re-derive the slug from the new name and break every link the member
        // had already shared.
        $this->seedUser(1, 'Aiden Carter');
        ProfileSlugService::slugFor(1);
        ProfileSlugService::setCustomSlug(1, 'ace');

        wp_update_user(['ID' => 1, 'display_name' => 'Aiden C']);

        $this->assertSame('ace', ProfileSlugService::slugFor(1));
        $this->assertTrue(ProfileSlugService::isCustom(1));
    }

    public function testADerivedSlugStillTracksTheDisplayName(): void
    {
        $this->seedUser(1, 'Aiden Carter');
        ProfileSlugService::slugFor(1);

        wp_update_user(['ID' => 1, 'display_name' => 'Aiden C']);

        $this->assertSame('aiden-c', ProfileSlugService::slugFor(1));
        // And the old one keeps resolving.
        $this->assertSame(1, ProfileSlugService::resolve('aiden-carter'));
    }

    private function seedUser(int $id, string $displayName): void
    {
        $user = new WP_User();
        $user->ID = $id;
        $user->display_name = $displayName;

        $GLOBALS['__wp_users'][$id] = $user;
    }
}
