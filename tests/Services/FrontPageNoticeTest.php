<?php

namespace BitApps\BitConnect\Tests\Services;

use BitApps\BitConnect\Config;
use BitApps\BitConnect\Services\PortalLocation;
use BitApps\BitConnect\Services\RootRouter;
use PHPUnit\Framework\TestCase;
use WP_Post;

/**
 * The root-mode front-page warning must be silenceable, and must come back
 * when the thing it warns about changes.
 *
 * A notice that reappears on every admin page load after being closed is the
 * WordPress.org "admin nag" signal. A notice that never returns once closed
 * would hide a real misconfiguration the next time the front page is moved.
 * The dismissal is therefore remembered against the front-page setting it
 * was given for.
 *
 * @internal
 *
 * @coversNothing
 */
final class FrontPageNoticeTest extends TestCase
{
    private const PORTAL_PAGE_ID = 42;

    private const OTHER_PAGE_ID = 7;

    private const ADMIN_ID = 3;

    protected function setUp(): void
    {
        $GLOBALS['__wp_home_url'] = 'https://example.com';
        $GLOBALS['__wp_posts'] = [$this->makePage(self::PORTAL_PAGE_ID, 'community')];
        $GLOBALS['__wp_caps'] = ['manage_options' => true];
        $GLOBALS['__wp_current_user_id'] = self::ADMIN_ID;
        $GLOBALS['__wp_user_meta'] = [];

        $this->configure(frontPage: self::OTHER_PAGE_ID);
    }

    protected function tearDown(): void
    {
        $GLOBALS['__wp_options'] = [];
        $GLOBALS['__wp_posts'] = [];
        $GLOBALS['__wp_caps'] = [];
        $GLOBALS['__wp_current_user_id'] = 0;
        $GLOBALS['__wp_user_meta'] = [];

        PortalLocation::resetCache();
    }

    public function testWarnsWhenRootModeIsOnButTheFrontPageIsElsewhere(): void
    {
        $this->assertTrue(RootRouter::shouldShowFrontPageNotice(self::ADMIN_ID));
    }

    public function testStaysQuietOnceTheFrontPageIsThePortal(): void
    {
        $this->configure(frontPage: self::PORTAL_PAGE_ID);

        $this->assertFalse(RootRouter::shouldShowFrontPageNotice(self::ADMIN_ID));
    }

    public function testStaysQuietForUsersWhoCannotFixIt(): void
    {
        $GLOBALS['__wp_caps'] = [];

        $this->assertFalse(RootRouter::shouldShowFrontPageNotice(self::ADMIN_ID));
    }

    public function testDismissalIsRememberedAcrossPageLoads(): void
    {
        RootRouter::rememberFrontPageNoticeDismissal(self::ADMIN_ID);

        $this->assertFalse(RootRouter::shouldShowFrontPageNotice(self::ADMIN_ID));

        // A fresh request reads the same stored answer.
        PortalLocation::resetCache();
        $this->assertFalse(RootRouter::shouldShowFrontPageNotice(self::ADMIN_ID));
    }

    public function testDismissalIsPerUser(): void
    {
        RootRouter::rememberFrontPageNoticeDismissal(self::ADMIN_ID);

        $this->assertTrue(RootRouter::shouldShowFrontPageNotice(self::ADMIN_ID + 1));
    }

    public function testWarningReturnsWhenTheFrontPageIsMovedAgain(): void
    {
        RootRouter::rememberFrontPageNoticeDismissal(self::ADMIN_ID);
        $this->assertFalse(RootRouter::shouldShowFrontPageNotice(self::ADMIN_ID));

        // Still wrong, but wrong in a new way: a different page, then the posts list.
        $this->configure(frontPage: self::OTHER_PAGE_ID + 1);
        $this->assertTrue(RootRouter::shouldShowFrontPageNotice(self::ADMIN_ID));

        $this->configure(frontPage: 0);
        $this->assertTrue(RootRouter::shouldShowFrontPageNotice(self::ADMIN_ID));
    }

    public function testDismissalKeyCarriesThePluginPrefix(): void
    {
        RootRouter::rememberFrontPageNoticeDismissal(self::ADMIN_ID);

        $keys = array_keys($GLOBALS['__wp_user_meta'][self::ADMIN_ID]);

        $this->assertCount(1, $keys);
        $this->assertStringStartsWith(Config::VAR_PREFIX, $keys[0]);
    }

    /**
     * Root mode on, portal on its slug, front page as given (0 = the posts list).
     */
    private function configure(int $frontPage): void
    {
        $GLOBALS['__wp_options'] = [
            Config::withPrefix('portal_page')               => 'community',
            Config::withPrefix(PortalLocation::ROOT_OPTION) => 1,
            'show_on_front'                                 => $frontPage > 0 ? 'page' : 'posts',
            'page_on_front'                                 => $frontPage,
        ];

        PortalLocation::resetCache();
    }

    private function makePage(int $id, string $slug): WP_Post
    {
        $page = new WP_Post();
        $page->ID = $id;
        $page->post_name = $slug;
        $page->post_type = 'page';
        $page->post_status = 'publish';

        return $page;
    }
}
