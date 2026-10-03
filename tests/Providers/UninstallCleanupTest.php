<?php

namespace BitApps\BitConnect\Tests\Providers;

use BitApps\BitConnect\Providers\InstallerProvider;
use BitApps\BitConnect\Services\AvatarService;
use BitApps\BitConnect\Services\CapabilityService;
use BitApps\BitConnect\Services\CoverImageService;
use BitApps\BitConnect\Services\EmailChangeService;
use BitApps\BitConnect\Services\MemberProfileService;
use BitApps\BitConnect\Services\NotificationDigest;
use BitApps\BitConnect\Services\NotificationPreferences;
use BitApps\BitConnect\Services\ProfileSlugService;
use BitApps\BitConnect\Services\RootRouter;
use PHPUnit\Framework\TestCase;
use ReflectionClassConstant;
use ReflectionMethod;
use WP_Post;
use WP_User;

/**
 * What "Delete Data on Uninstall" actually removes, and what it must not.
 *
 * Both cases here are regressions rather than hypotheticals. The portal page
 * was matched by the literal slug 'portal' while the real one is recorded in
 * the `portal_page` option, so every forum whose portal had been named — which
 * the onboarding wizard does as a matter of course — kept its page after an
 * uninstall that said it would go. And the option sweep matched the bare
 * `bit_connect_` prefix, which swallows the add-on's `bit_connect_pro_`
 * namespace and its licence key with it.
 *
 * Uninstall code is only ever run once, by someone who has already left, so
 * nothing about it is observable in normal use. These tests are the only place
 * it gets exercised at all.
 *
 * @internal
 *
 * @coversNothing
 */
final class UninstallCleanupTest extends TestCase
{
    public static function setUpBeforeClass(): void
    {
        require_once \dirname(__DIR__) . '/doubles/user-meta-functions.php';
    }

    protected function setUp(): void
    {
        $GLOBALS['__wp_options'] = [];
        $GLOBALS['__wp_posts'] = [];
        $GLOBALS['__wp_deleted_posts'] = [];
        $GLOBALS['__wp_user_meta'] = [];
        $GLOBALS['__wp_users'] = [];
    }

    protected function tearDown(): void
    {
        $GLOBALS['__wp_options'] = [];
        $GLOBALS['__wp_posts'] = [];
        $GLOBALS['__wp_deleted_posts'] = [];
        $GLOBALS['__wp_user_meta'] = [];
        $GLOBALS['__wp_users'] = [];
    }

    // -----------------------------------------------------------------------
    // Which page is the portal
    // -----------------------------------------------------------------------

    public function testTheStoredSlugIsWhatGetsCleanedUp(): void
    {
        $GLOBALS['__wp_options']['bit_connect_portal_page'] = 'community';

        $this->assertSame(['community', 'portal'], InstallerProvider::portalPageSlugs());
    }

    /**
     * A forum that never moved its portal, or lost the option, still has its
     * default page removed.
     */
    public function testWithNothingStoredItFallsBackToTheDefaultSlug(): void
    {
        $this->assertSame(['portal'], InstallerProvider::portalPageSlugs());
    }

    public function testAStoredSlugOfPortalIsNotListedTwice(): void
    {
        $GLOBALS['__wp_options']['bit_connect_portal_page'] = 'portal';

        $this->assertSame(['portal'], InstallerProvider::portalPageSlugs());
    }

    /**
     * The option is written as a bare post_name, but has been seen carrying
     * slashes; a slug of '/community/' must not miss the page.
     */
    public function testASlugStoredWithSlashesStillMatches(): void
    {
        $GLOBALS['__wp_options']['bit_connect_portal_page'] = '/community/';

        $this->assertSame(['community', 'portal'], InstallerProvider::portalPageSlugs());
    }

    public function testAnUnusableStoredValueIsIgnoredRatherThanSearchedFor(): void
    {
        $GLOBALS['__wp_options']['bit_connect_portal_page'] = ['not', 'a', 'slug'];

        $this->assertSame(['portal'], InstallerProvider::portalPageSlugs());
    }

    // -----------------------------------------------------------------------
    // Which options are ours
    // -----------------------------------------------------------------------

    public function testOurOwnOptionsAreSwept(): void
    {
        $this->assertTrue(InstallerProvider::ownsOption('bit_connect_admin_settings'));
        $this->assertTrue(InstallerProvider::ownsOption('bit_connect_notification_settings'));
        $this->assertTrue(InstallerProvider::ownsOption('bit_connect_portal_page'));
    }

    /**
     * The whole point. `bit_connect_pro_` begins with `bit_connect_`, so a
     * prefix sweep takes the add-on's licence with it.
     */
    public function testTheAddOnsOptionsAreLeftAlone(): void
    {
        $this->assertFalse(InstallerProvider::ownsOption('bit_connect_pro_license_data'));
        $this->assertFalse(InstallerProvider::ownsOption('bit_connect_pro_anything_at_all'));
    }

    public function testOtherPluginsOptionsAreNotOurs(): void
    {
        $this->assertFalse(InstallerProvider::ownsOption('siteurl'));
        $this->assertFalse(InstallerProvider::ownsOption('some_other_plugin_settings'));
    }

    /**
     * A name that merely contains the prefix is not one of ours: the sweep
     * anchors at the start, and so must this.
     */
    public function testAPrefixInTheMiddleOfANameDoesNotCount(): void
    {
        $this->assertFalse(InstallerProvider::ownsOption('other_bit_connect_settings'));
    }

    // -----------------------------------------------------------------------
    // End to end over the stubbed post store
    // -----------------------------------------------------------------------

    public function testTheNamedPortalPageAndEveryTopicAreRemovedTogether(): void
    {
        $GLOBALS['__wp_options']['bit_connect_portal_page'] = 'community';
        $GLOBALS['__wp_posts'] = [
            11 => $this->post(11, 'a-topic', 'bit-connect'),
            12 => $this->post(12, 'another-topic', 'bit-connect'),
            13 => $this->post(13, 'community', 'page'),
            14 => $this->post(14, 'about-us', 'page'),
        ];

        InstallerProvider::deletePluginPosts();

        $left = array_keys($GLOBALS['__wp_posts']);

        $this->assertSame([14], $left, 'Only the unrelated page should survive');
    }

    // -----------------------------------------------------------------------
    // What members leave behind
    // -----------------------------------------------------------------------

    /**
     * The list is hand-kept, so it is checked against the constant each
     * service actually writes under. A key added to a service and forgotten
     * here would otherwise survive the uninstall unnoticed.
     */
    public function testEveryUserMetaKeyAServiceWritesIsCleanedUp(): void
    {
        $written = [
            [AvatarService::class, 'META_KEY'],
            [CoverImageService::class, 'META_KEY'],
            [MemberProfileService::class, 'META_BIO'],
            [MemberProfileService::class, 'META_LINKS'],
            [ProfileSlugService::class, 'META_SLUG'],
            [ProfileSlugService::class, 'META_ALIASES'],
            [ProfileSlugService::class, 'META_CUSTOM'],
            [NotificationPreferences::class, 'META_KEY'],
            [NotificationDigest::class, 'META_LAST_SENT'],
            [EmailChangeService::class, 'META_PENDING'],
            [EmailChangeService::class, 'META_TOKEN'],
            [EmailChangeService::class, 'META_EXPIRY'],
        ];
        $keys = array_map(
            static fn (array $c): string => (new ReflectionClassConstant($c[0], $c[1]))->getValue(),
            $written
        );
        $keys[] = (new ReflectionMethod(RootRouter::class, 'noticeDismissedMetaKey'))->invoke(null);

        $this->assertSame([], array_values(array_diff($keys, InstallerProvider::ownUserMetaKeys())));
    }

    /**
     * The add-on keeps members' badges in user meta inside this plugin's
     * prefix; it is the add-on's to remove, not this plugin's.
     */
    public function testMembersMetaGoesAndTheAddOnsAndOtherPluginsStays(): void
    {
        $GLOBALS['__wp_user_meta'] = [
            2 => [
                'bit_connect_profile_slug'   => 'amara',
                'bit_connect_avatar_id'      => 40,
                'bit_connect_profile_badges' => ['b1'],
                'first_name'                 => 'Amara',
            ],
            3 => [
                'bit_connect_notification_prefs' => ['reply' => true],
                'some_other_plugin_meta'         => 'x',
            ],
        ];

        InstallerProvider::deletePluginUserMeta();

        $this->assertSame(
            [
                2 => ['bit_connect_profile_badges' => ['b1'], 'first_name' => 'Amara'],
                3 => ['some_other_plugin_meta' => 'x'],
            ],
            $GLOBALS['__wp_user_meta']
        );
    }

    /**
     * Grants and revokes alike: a revoke is stored as false, and a false entry
     * left in place would still read as a deliberate override.
     */
    public function testPerUserCapabilityOverridesAreRemoved(): void
    {
        $member = $this->userWithCaps(2, [
            'subscriber'                    => true,
            'bit_connect_forum_create_post' => true,
            'bit_connect_forum_manage'      => false,
            'some_other_plugin_cap'         => true,
        ]);
        $plain = $this->userWithCaps(3, ['subscriber' => true]);
        $GLOBALS['__wp_users'] = [2 => $member, 3 => $plain];

        $updated = CapabilityService::removeAllUserCapabilities([2, 3]);

        $this->assertSame(1, $updated);
        $this->assertSame(['subscriber' => true, 'some_other_plugin_cap' => true], $member->caps);
        $this->assertSame(['subscriber' => true], $plain->caps);
    }

    private function userWithCaps(int $id, array $caps): WP_User
    {
        $user = new class() extends WP_User {
            public $caps = [];

            public function remove_cap($cap): void
            {
                unset($this->caps[$cap]);
            }
        };
        $user->ID = $id;
        $user->caps = $caps;

        return $user;
    }

    private function post(int $id, string $slug, string $type): WP_Post
    {
        $post = new WP_Post();
        $post->ID = $id;
        $post->post_name = $slug;
        $post->post_type = $type;
        $post->post_status = 'publish';

        return $post;
    }
}
