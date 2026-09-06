<?php

namespace BitApps\BitConnect\Tests\Providers;

use BitApps\BitConnect\Providers\InstallerProvider;
use PHPUnit\Framework\TestCase;
use WP_Post;

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
    protected function setUp(): void
    {
        $GLOBALS['__wp_options'] = [];
        $GLOBALS['__wp_posts'] = [];
        $GLOBALS['__wp_deleted_posts'] = [];
    }

    protected function tearDown(): void
    {
        $GLOBALS['__wp_options'] = [];
        $GLOBALS['__wp_posts'] = [];
        $GLOBALS['__wp_deleted_posts'] = [];
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
