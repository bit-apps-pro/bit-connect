<?php

namespace BitApps\BitConnect\Tests\Services;

use BitApps\BitConnect\Config;
use BitApps\BitConnect\Services\PortalLocation;
use PHPUnit\Framework\TestCase;
use WP_Post;

/**
 * Pins down where the portal lives and how its URLs are built.
 *
 * Every canonical, sitemap entry and CPT redirect is built from PortalLocation,
 * so a wrong answer here does not fail loudly — it quietly publishes URLs that
 * serve the wrong thing, or nothing at all.
 *
 * "Root" means the root of the WordPress install, not the domain: a
 * subdirectory install at example.com/forum roots the portal at /forum/. Both
 * shapes are asserted because both are supported placements.
 *
 * @internal
 *
 * @coversNothing
 */
final class PortalLocationTest extends TestCase
{
    private const PORTAL_PAGE_ID = 42;

    protected function setUp(): void
    {
        $GLOBALS['__wp_home_url'] = 'https://example.com';
        $GLOBALS['__wp_posts'] = [$this->makePage(self::PORTAL_PAGE_ID, 'community')];

        $this->configure(slug: 'community', root: false);
    }

    protected function tearDown(): void
    {
        $GLOBALS['__wp_options'] = [];
        $GLOBALS['__wp_posts'] = [];
        $GLOBALS['__wp_urls_to_postid'] = [];

        PortalLocation::resetCache();
    }

    // -----------------------------------------------------------------------
    // Slug mode
    // -----------------------------------------------------------------------

    public function testSlugModeBuildsUrlsBeneathTheSlug(): void
    {
        $this->assertSame('https://example.com/community', PortalLocation::url());
        $this->assertSame('https://example.com/community/hello-world', PortalLocation::url('hello-world'));
    }

    public function testSlugModeIsNotServingAtRoot(): void
    {
        $this->assertFalse(PortalLocation::isServingAtRoot());
    }

    public function testLeadingSlashOnThePathIsNotDoubled(): void
    {
        $this->assertSame('https://example.com/community/hello-world', PortalLocation::url('/hello-world'));
    }

    // -----------------------------------------------------------------------
    // Root mode
    // -----------------------------------------------------------------------

    public function testRootModeBuildsUrlsAtTheInstallRoot(): void
    {
        $this->configure(slug: 'community', root: true, frontPage: self::PORTAL_PAGE_ID);

        $this->assertSame('https://example.com/', PortalLocation::url());
        $this->assertSame('https://example.com/hello-world', PortalLocation::url('hello-world'));
    }

    public function testRootModeIsServingAtRootOnceBound(): void
    {
        $this->configure(slug: 'community', root: true, frontPage: self::PORTAL_PAGE_ID);

        $this->assertTrue(PortalLocation::isServingAtRoot());
    }

    // -----------------------------------------------------------------------
    // Subdirectory install — root is the install root, not the domain root
    // -----------------------------------------------------------------------

    public function testSubdirectoryInstallRootsThePortalAtTheInstallPath(): void
    {
        $GLOBALS['__wp_home_url'] = 'https://example.com/forum';
        $this->configure(slug: 'community', root: true, frontPage: self::PORTAL_PAGE_ID);

        $this->assertSame('https://example.com/forum/', PortalLocation::url());
        $this->assertSame('https://example.com/forum/hello-world', PortalLocation::url('hello-world'));
    }

    public function testSubdirectoryInstallKeepsTheSlugBeneathTheInstallPath(): void
    {
        $GLOBALS['__wp_home_url'] = 'https://example.com/forum';

        $this->assertSame('https://example.com/forum/community/hello-world', PortalLocation::url('hello-world'));
    }

    // -----------------------------------------------------------------------
    // The half-configured state
    //
    // Root mode that is switched on but not front-page bound used to build root
    // URLs anyway. Nothing served them, so the CPT redirect bounced against
    // WordPress's 404 permalink guessing and the request never terminated.
    // Falling back to slug URLs is what keeps that from recurring.
    // -----------------------------------------------------------------------

    public function testRootFlagWithoutAFrontPageBindingFallsBackToSlugUrls(): void
    {
        $this->configure(slug: 'community', root: true, frontPage: 0);

        $this->assertFalse(PortalLocation::isServingAtRoot());
        $this->assertSame('https://example.com/community/hello-world', PortalLocation::url('hello-world'));
    }

    public function testRootFlagIsNotEnoughWhenTheFrontPageIsAnotherPage(): void
    {
        $this->configure(slug: 'community', root: true, frontPage: 999);

        $this->assertFalse(PortalLocation::isServingAtRoot());
        $this->assertSame('https://example.com/community', PortalLocation::url());
    }

    public function testRootFlagIsNotEnoughWhenTheSiteShowsPostsOnTheFrontPage(): void
    {
        $this->configure(slug: 'community', root: true, frontPage: self::PORTAL_PAGE_ID);
        update_option('show_on_front', 'posts');
        PortalLocation::resetCache();

        $this->assertFalse(PortalLocation::isServingAtRoot());
    }

    public function testRootModeWithoutAPortalPageIsNotServingAtRoot(): void
    {
        $GLOBALS['__wp_posts'] = [];
        $this->configure(slug: 'community', root: true, frontPage: self::PORTAL_PAGE_ID);

        $this->assertFalse(PortalLocation::isServingAtRoot());
    }

    // -----------------------------------------------------------------------
    // Auth-route ownership
    //
    // Custom-URL mode sends visitors elsewhere to sign in. A value pointing back
    // at a screen the portal renders itself is a redirect loop, so it is dropped
    // — but in root mode `/login` is also where membership plugins put their own
    // page, and RootRouter only claims URLs WordPress leaves as 404s. Dropping
    // that one sent every visitor to wp-login.php instead of the configured page.
    // -----------------------------------------------------------------------

    public function testSlugModeOwnsItsOwnAuthRoutes(): void
    {
        $this->assertTrue(PortalLocation::ownsAuthRoute('https://example.com/community/login'));
        $this->assertTrue(PortalLocation::ownsAuthRoute('https://example.com/community/register/'));
    }

    public function testSlugModeDoesNotOwnAuthRoutesOutsideThePortal(): void
    {
        $this->assertFalse(PortalLocation::ownsAuthRoute('https://example.com/login'));
        $this->assertFalse(PortalLocation::ownsAuthRoute('https://example.com/members/login'));
    }

    public function testRootModeOwnsAnAuthRouteNothingElseAnswers(): void
    {
        $this->configure(slug: 'community', root: true, frontPage: self::PORTAL_PAGE_ID);

        $this->assertTrue(PortalLocation::ownsAuthRoute('https://example.com/login'));
        $this->assertTrue(PortalLocation::ownsAuthRoute('https://example.com/register/'));
    }

    public function testRootModeYieldsAnAuthRouteToARealPage(): void
    {
        $this->configure(slug: 'community', root: true, frontPage: self::PORTAL_PAGE_ID);
        $GLOBALS['__wp_urls_to_postid'] = ['login' => 77, 'register' => 78];

        $this->assertFalse(PortalLocation::ownsAuthRoute('https://example.com/login/'));
        $this->assertFalse(PortalLocation::ownsAuthRoute('https://example.com/register/'));
    }

    public function testAnotherHostIsNeverThePortalsOwnRoute(): void
    {
        $this->configure(slug: 'community', root: true, frontPage: self::PORTAL_PAGE_ID);

        $this->assertFalse(PortalLocation::ownsAuthRoute('https://accounts.example.org/login'));
    }

    public function testSubdirectoryInstallComparesPathsBeneathTheInstallRoot(): void
    {
        $GLOBALS['__wp_home_url'] = 'https://example.com/forum';
        $this->configure(slug: 'community', root: true, frontPage: self::PORTAL_PAGE_ID);

        $this->assertTrue(PortalLocation::ownsAuthRoute('https://example.com/forum/login'));
        // Outside the install: another application's login page, not the portal's.
        $this->assertFalse(PortalLocation::ownsAuthRoute('https://example.com/login'));
    }

    // -----------------------------------------------------------------------
    // Lookups
    // -----------------------------------------------------------------------

    public function testSlugIsReportedWithoutSurroundingSlashes(): void
    {
        $this->configure(slug: '/community/', root: false);

        $this->assertSame('community', PortalLocation::slug());
    }

    public function testPageIsNullWhenNoPortalIsConfigured(): void
    {
        $this->configure(slug: '', root: false);

        $this->assertNull(PortalLocation::page());
    }

    public function testPageIsNullWhenTheConfiguredSlugMatchesNoPage(): void
    {
        $this->configure(slug: 'nowhere', root: false);

        $this->assertNull(PortalLocation::page());
    }

    public function testPageResolvesTheConfiguredSlug(): void
    {
        $page = PortalLocation::page();

        $this->assertInstanceOf(WP_Post::class, $page);
        $this->assertSame(self::PORTAL_PAGE_ID, $page->ID);
    }

    public function testAnUnpublishedPageIsNotThePortalPage(): void
    {
        $GLOBALS['__wp_posts'] = [$this->makePage(self::PORTAL_PAGE_ID, 'community', 'draft')];
        PortalLocation::resetCache();

        $this->assertNull(PortalLocation::page());
    }

    public function testResetCachePicksUpAChangedBinding(): void
    {
        $this->configure(slug: 'community', root: true, frontPage: 0);
        $this->assertFalse(PortalLocation::isServingAtRoot());

        update_option('show_on_front', 'page');
        update_option('page_on_front', self::PORTAL_PAGE_ID);
        PortalLocation::resetCache();

        $this->assertTrue(PortalLocation::isServingAtRoot());
    }

    /**
     * Seed the options PortalLocation reads, and clear its memo.
     */
    private function configure(string $slug, bool $root, int $frontPage = 0): void
    {
        $GLOBALS['__wp_options'] = [
            Config::withPrefix('portal_page')              => $slug,
            Config::withPrefix(PortalLocation::ROOT_OPTION) => $root ? 1 : 0,
            'show_on_front'                                => $frontPage > 0 ? 'page' : 'posts',
            'page_on_front'                                => $frontPage,
        ];

        PortalLocation::resetCache();
    }

    private function makePage(int $id, string $slug, string $status = 'publish'): WP_Post
    {
        $page = new WP_Post();
        $page->ID = $id;
        $page->post_name = $slug;
        $page->post_type = 'page';
        $page->post_status = $status;

        return $page;
    }
}
