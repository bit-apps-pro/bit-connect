<?php

namespace BitApps\BitConnect\Tests\Services;

use BitApps\BitConnect\Config;
use BitApps\BitConnect\Enum\AuthSettings;
use BitApps\BitConnect\Enum\Capabilities;
use BitApps\BitConnect\Services\AuthService;
use BitApps\BitConnect\Services\PortalLocation;
use PHPUnit\Framework\TestCase;
use WP_Post;
use WP_User;

/**
 * Where the portal sends someone to sign in, and who it lets in.
 *
 * The failure this file guards against has one shape: a member who cannot sign
 * in and has no way to say so. Custom-URL mode is where it happens — an
 * administrator can point the portal at a page that does not exist, or at the
 * portal's own /login route, which would send a visitor round in a loop
 * forever. Both come back as "no custom page", and the portal then falls back
 * to the WordPress login URL, which is itself filtered and so already points at
 * whatever login page the site really uses.
 *
 * @internal
 *
 * @coversNothing
 */
final class AuthSettingsResolutionTest extends TestCase
{
    private const MEMBER = 3;

    protected function setUp(): void
    {
        $GLOBALS['__wp_options'] = [];
        $GLOBALS['__wp_site_options'] = [];
        $GLOBALS['__wp_users'] = [];
        $GLOBALS['__wp_user_caps'] = [];
        $GLOBALS['__wp_current_user_id'] = 0;
        $GLOBALS['__wp_home_url'] = 'https://example.com';
        $GLOBALS['__wp_posts'] = [];
        $GLOBALS['__wp_urls_to_postid'] = [];
        $GLOBALS['__wp_filters'] = [];
        $GLOBALS['__wp_is_multisite'] = false;

        PortalLocation::resetCache();
    }

    protected function tearDown(): void
    {
        $GLOBALS['__wp_options'] = [];
        $GLOBALS['__wp_users'] = [];
        $GLOBALS['__wp_user_caps'] = [];
        $GLOBALS['__wp_current_user_id'] = 0;
        $GLOBALS['__wp_is_multisite'] = false;

        PortalLocation::resetCache();
    }

    // -----------------------------------------------------------------------
    // Reading the settings
    // -----------------------------------------------------------------------

    /**
     * A forum that has never opened the auth screen uses WordPress's own login,
     * which is the behaviour that existed before the screen did.
     */
    public function testAForumThatNeverSawTheScreenUsesTheDefaultMode(): void
    {
        $this->assertSame(AuthSettings::MODE_PLUGIN_DEFAULT->value, AuthService::getMode());
        $this->assertFalse(AuthService::isCustomUrlMode());
    }

    /**
     * A payload saved by an older release carries fewer keys than this one
     * expects, and the missing ones have to read as their defaults rather than
     * as absent.
     */
    public function testAPartiallySavedPayloadIsFilledInFromTheDefaults(): void
    {
        $this->storeSettings(['mode' => AuthSettings::MODE_CUSTOM_URL->value]);

        $settings = AuthService::getSettings();

        $this->assertSame(AuthSettings::MODE_CUSTOM_URL->value, $settings['mode']);
        $this->assertSame('', $settings['redirectAfterLogin']);
        $this->assertFalse($settings['requireEmailVerification']);
        $this->assertArrayHasKey('loginPageCustomization', $settings);
    }

    public function testAnOptionThatIsNotAnArrayFallsBackToTheDefaults(): void
    {
        $GLOBALS['__wp_options'][Config::withPrefix(AuthSettings::OPTION_NAME->value)] = 'corrupted';

        $this->assertSame(AuthService::defaultSettings(), AuthService::getSettings());
    }

    public function testEmailVerificationIsOffUntilSomebodyTurnsItOn(): void
    {
        $this->assertFalse(AuthService::requiresEmailVerification());

        $this->storeSettings(['requireEmailVerification' => true]);

        $this->assertTrue(AuthService::requiresEmailVerification());
    }

    // -----------------------------------------------------------------------
    // The custom login page
    // -----------------------------------------------------------------------

    public function testACustomLoginPageIsHandedToThePortalAsItWasEntered(): void
    {
        $this->storeSettings([
            'customLoginUrl'        => 'https://accounts.example.com/login',
            'customRegistrationUrl' => 'https://accounts.example.com/register',
            'mode'                  => AuthSettings::MODE_CUSTOM_URL->value,
        ]);

        $this->assertSame('https://accounts.example.com/login', AuthService::customLoginUrl());
        $this->assertSame('https://accounts.example.com/register', AuthService::customRegistrationUrl());
    }

    public function testAnUnsetCustomPageIsReportedAsNoneAtAll(): void
    {
        $this->storeSettings(['mode' => AuthSettings::MODE_CUSTOM_URL->value]);

        $this->assertSame('', AuthService::customLoginUrl());
        $this->assertSame('', AuthService::customRegistrationUrl());
    }

    public function testWhitespaceIsNotACustomPage(): void
    {
        $this->storeSettings(['customLoginUrl' => '   ']);

        $this->assertSame('', AuthService::customLoginUrl());
    }

    /**
     * Pointing the custom login page at the portal's own /login route sends a
     * visitor round in a loop forever. It comes back as "no custom page", and
     * the portal falls back to the WordPress login URL.
     */
    public function testACustomPagePointingAtThePortalsOwnLoginRouteIsRefused(): void
    {
        $this->servePortalAtSlug('community');
        $this->storeSettings([
            'customLoginUrl' => 'https://example.com/community/login',
            'mode'           => AuthSettings::MODE_CUSTOM_URL->value,
        ]);

        $this->assertSame('', AuthService::customLoginUrl());
    }

    public function testAPageElsewhereOnTheSameSiteIsStillUsable(): void
    {
        $this->servePortalAtSlug('community');
        $this->storeSettings([
            'customLoginUrl' => 'https://example.com/members/sign-in',
            'mode'           => AuthSettings::MODE_CUSTOM_URL->value,
        ]);

        $this->assertSame('https://example.com/members/sign-in', AuthService::customLoginUrl());
    }

    // -----------------------------------------------------------------------
    // Where signing in and out lands
    // -----------------------------------------------------------------------

    /**
     * Built through core's own helper, which third-party auth plugins filter —
     * so a site using one keeps working without this knowing about it.
     */
    public function testSigningInGoesThroughCoresOwnLoginUrl(): void
    {
        $this->assertStringContainsString('/wp-login.php', AuthService::getLoginUrl());
        $this->assertStringContainsString('action=logout', AuthService::getLogoutUrl());
    }

    public function testTheDefaultLandingPlaceIsTheSiteItself(): void
    {
        $this->assertSame('https://example.com/', AuthService::getLoginRedirect());
        $this->assertSame('https://example.com/', AuthService::getLogoutRedirect());
    }

    public function testAConfiguredLandingPlaceIsUsedInstead(): void
    {
        $this->storeSettings([
            'redirectAfterLogin'  => 'https://example.com/community',
            'redirectAfterLogout' => 'https://example.com/goodbye',
        ]);

        $this->assertSame('https://example.com/community', AuthService::getLoginRedirect());
        $this->assertSame('https://example.com/goodbye', AuthService::getLogoutRedirect());
    }

    public function testAnExplicitRedirectBeatsTheConfiguredOne(): void
    {
        $this->storeSettings(['redirectAfterLogin' => 'https://example.com/community']);

        $this->assertStringContainsString(
            rawurlencode('https://example.com/topic/9'),
            AuthService::getLoginUrl('https://example.com/topic/9')
        );
    }

    // -----------------------------------------------------------------------
    // Whether anyone may sign up
    // -----------------------------------------------------------------------

    public function testSignupFollowsWordPressOwnSwitch(): void
    {
        $this->assertFalse(AuthService::canRegister());

        update_option('users_can_register', 1);

        $this->assertTrue(AuthService::canRegister());
    }

    /**
     * Multisite ignores users_can_register entirely; the network-wide option
     * decides, and reading the single-site one there would offer a signup form
     * the network refuses.
     */
    public function testOnMultisiteTheNetworkSettingDecides(): void
    {
        $GLOBALS['__wp_is_multisite'] = true;
        update_option('users_can_register', 1);

        $GLOBALS['__wp_site_options']['registration'] = 'none';
        $this->assertFalse(AuthService::canRegister());

        foreach (['user', 'all'] as $allowed) {
            $GLOBALS['__wp_site_options']['registration'] = $allowed;
            $this->assertTrue(AuthService::canRegister(), $allowed . ' should allow signup');
        }

        $GLOBALS['__wp_site_options']['registration'] = 'blog';
        $this->assertFalse(AuthService::canRegister());
    }

    // -----------------------------------------------------------------------
    // Who counts as a forum member
    // -----------------------------------------------------------------------

    public function testAnyoneHoldingAParticipationCapabilityIsAMember(): void
    {
        foreach (Capabilities::memberCaps() as $capability) {
            $this->seedUser(self::MEMBER, [$capability->value]);

            $this->assertTrue(AuthService::hasForumRole(self::MEMBER), $capability->value . ' should admit them');
        }
    }

    public function testSomeoneHoldingNoneOfThemIsNot(): void
    {
        $this->seedUser(self::MEMBER, []);

        $this->assertFalse(AuthService::hasForumRole(self::MEMBER));
    }

    /**
     * A site administrator can always reach the forum, whatever Manager says
     * about the granular capabilities.
     */
    public function testASiteAdministratorIsAlwaysAMember(): void
    {
        $this->seedUser(self::MEMBER, ['manage_options']);

        $this->assertTrue(AuthService::hasForumRole(self::MEMBER));
        $this->assertTrue(AuthService::hasModeratorRole(self::MEMBER));
    }

    public function testHoldingTheForumsOwnManageCapabilityIsEnoughToModerate(): void
    {
        $this->seedUser(self::MEMBER, [Capabilities::MANAGE->value]);

        $this->assertTrue(AuthService::hasModeratorRole(self::MEMBER));
    }

    public function testAnOrdinaryMemberDoesNotModerate(): void
    {
        $this->seedUser(self::MEMBER, [Capabilities::CREATE_POST->value]);

        $this->assertFalse(AuthService::hasModeratorRole(self::MEMBER));
    }

    public function testALoggedOutVisitorIsNeitherAMemberNorAModerator(): void
    {
        $this->assertFalse(AuthService::hasForumRole());
        $this->assertFalse(AuthService::hasModeratorRole());
    }

    public function testAnAccountThatIsGoneIsNeitherEither(): void
    {
        $this->assertFalse(AuthService::hasForumRole(404));
        $this->assertFalse(AuthService::hasModeratorRole(404));
    }

    public function testTheCurrentUserIsAssumedWhenNoIdIsGiven(): void
    {
        $this->seedUser(self::MEMBER, [Capabilities::CREATE_POST->value]);
        $GLOBALS['__wp_current_user_id'] = self::MEMBER;

        $this->assertTrue(AuthService::hasForumRole());
    }

    // -----------------------------------------------------------------------
    // The extension point
    // -----------------------------------------------------------------------

    public function testAnActionIsAllowedForAForumMember(): void
    {
        $this->seedUser(self::MEMBER, [Capabilities::CREATE_POST->value]);

        $this->assertTrue(AuthService::canPerform('create_post', self::MEMBER));
    }

    public function testAFilterMayOverrideTheAnswerEitherWay(): void
    {
        $this->seedUser(self::MEMBER, [Capabilities::CREATE_POST->value]);

        $GLOBALS['__wp_filters']['bit_connect_can_perform'] = false;
        $this->assertFalse(AuthService::canPerform('create_post', self::MEMBER));

        $GLOBALS['__wp_filters']['bit_connect_can_perform'] = true;
        $this->assertTrue(AuthService::canPerform('create_post', 404));
    }

    // -----------------------------------------------------------------------
    // Where the portal lives
    // -----------------------------------------------------------------------

    public function testThePortalPageUrlIsFoundFromTheStoredSlug(): void
    {
        $this->servePortalAtSlug('community');

        $this->assertSame('https://example.com/?p=42', AuthService::getForumPageUrl());
    }

    /**
     * An install whose portal page was deleted still has to send people
     * somewhere rather than to an empty string.
     */
    public function testAMissingPortalPageFallsBackToTheSiteRoot(): void
    {
        $this->assertSame('https://example.com', AuthService::getForumPageUrl());
    }

    // -----------------------------------------------------------------------
    // Helpers
    // -----------------------------------------------------------------------

    /**
     * @param array<string, mixed> $settings
     */
    private function storeSettings(array $settings): void
    {
        $GLOBALS['__wp_options'][Config::withPrefix(AuthSettings::OPTION_NAME->value)] = $settings;
    }

    /**
     * @param string[] $capabilities
     */
    private function seedUser(int $userId, array $capabilities): void
    {
        $user = new WP_User();
        $user->ID = $userId;
        $user->display_name = 'Member ' . $userId;

        $GLOBALS['__wp_users'][$userId] = $user;
        $GLOBALS['__wp_user_caps'][$userId] = array_fill_keys($capabilities, true);
    }

    private function servePortalAtSlug(string $slug): void
    {
        $page = new WP_Post();
        $page->ID = 42;
        $page->post_name = $slug;
        $page->post_type = 'page';
        $page->post_status = 'publish';

        $GLOBALS['__wp_posts'] = [$page];
        $GLOBALS['__wp_options'][Config::withPrefix('portal_page')] = $slug;

        PortalLocation::resetCache();
    }
}
