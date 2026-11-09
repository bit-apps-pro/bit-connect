<?php

namespace BitApps\BitConnect\Tests\Services;

use BitApps\BitConnect\Enum\Capabilities;
use BitApps\BitConnect\Services\CapabilityService;
use PHPUnit\Framework\TestCase;
use WP_Role;
use WP_Roles;

class CapabilityServiceTest extends TestCase
{
    private WP_Roles $wpRoles;

    protected function setUp(): void
    {
        $this->wpRoles                  = new WP_Roles();
        $GLOBALS['__wp_roles']          = $this->wpRoles;
        $GLOBALS['__wp_options']        = [];
    }

    private function addRole(string $slug, string $name, array $caps): void
    {
        $role = new WP_Role($name, $caps);
        // Inject into the stub via reflection (WP_Roles::roles is private)
        $ref = new \ReflectionProperty(WP_Roles::class, 'roles');
        $ref->setAccessible(true);
        $all         = $ref->getValue($this->wpRoles);
        $all[$slug]  = $role;
        $ref->setValue($this->wpRoles, $all);
    }

    public function testAdministratorGetsAllCapsOnFreshInstall(): void
    {
        $this->addRole('administrator', 'Administrator', ['manage_options' => true, 'read' => true]);

        $settings = CapabilityService::buildDefaultSettings();

        $this->assertSame(Capabilities::capMap(Capabilities::adminCaps()), $settings['administrator']);
    }

    public function testEditorGetsNoCapsOnFreshInstall(): void
    {
        $this->addRole('editor', 'Editor', ['edit_others_posts' => true, 'read' => true]);

        $settings = CapabilityService::buildDefaultSettings();

        $this->assertSame([], $settings['editor']);
    }

    public function testSubscriberGetsNoCapsOnFreshInstall(): void
    {
        $this->addRole('subscriber', 'Subscriber', ['read' => true]);

        $settings = CapabilityService::buildDefaultSettings();

        $this->assertSame([], $settings['subscriber']);
    }

    public function testAuthorGetsNoCapsOnFreshInstall(): void
    {
        $this->addRole('author', 'Author', ['edit_posts' => true, 'read' => true]);

        $settings = CapabilityService::buildDefaultSettings();

        $this->assertSame([], $settings['author']);
    }

    public function testMultipleRolesOnlyAdminHasCaps(): void
    {
        $this->addRole('administrator', 'Administrator', ['manage_options' => true, 'read' => true]);
        $this->addRole('editor', 'Editor', ['edit_others_posts' => true, 'read' => true]);
        $this->addRole('subscriber', 'Subscriber', ['read' => true]);

        $settings = CapabilityService::buildDefaultSettings();

        $this->assertSame(Capabilities::capMap(Capabilities::adminCaps()), $settings['administrator']);
        $this->assertSame([], $settings['editor']);
        $this->assertSame([], $settings['subscriber']);
    }

    public function testCustomRoleWithManageOptionsGetsAdminCaps(): void
    {
        $this->addRole('shop_manager', 'Shop Manager', ['manage_options' => true, 'read' => true]);

        $settings = CapabilityService::buildDefaultSettings();

        $this->assertSame(Capabilities::capMap(Capabilities::adminCaps()), $settings['shop_manager']);
    }

    public function testInitDefaultSettingsIsNoOpWhenSettingsExist(): void
    {
        $GLOBALS['__wp_options']['bit_connect_capability_settings'] = ['existing' => 'data'];

        $this->addRole('administrator', 'Administrator', ['manage_options' => true]);

        CapabilityService::initDefaultSettings();

        // Should not overwrite existing settings
        $this->assertSame(['existing' => 'data'], $GLOBALS['__wp_options']['bit_connect_capability_settings']);
    }

    /**
     * Deactivation removes a capability another plugin adds. Reactivation runs
     * before that plugin can boot, so only the pass after activation, with its
     * listener registered, gives the capability back.
     */
    public function testListenerCapabilityComesBackAfterReactivation(): void
    {
        $extra = 'bit_connect_forum_extra';
        $withExtra = static fn (array $caps): array => [...$caps, $extra];

        $this->addRole('administrator', 'Administrator', ['manage_options' => true]);
        $GLOBALS['__wp_options']['bit_connect_capability_settings'] = [
            'administrator' => Capabilities::capMap(Capabilities::adminCaps()) + [$extra => true],
        ];

        try {
            // Deactivation, with the listener registered.
            $GLOBALS['__wp_filters']['bit_connect_capabilities'] = $withExtra;
            CapabilityService::removeAllCapabilities();

            // Reactivation, before the listener boots.
            unset($GLOBALS['__wp_filters']['bit_connect_capabilities']);
            CapabilityService::applySettings(CapabilityService::getSettings());
            CapabilityService::requestReapply();
            $this->assertArrayNotHasKey($extra, get_role('administrator')->capabilities);

            // The next full request.
            $GLOBALS['__wp_filters']['bit_connect_capabilities'] = $withExtra;
            CapabilityService::applyAfterActivation();
        } finally {
            unset($GLOBALS['__wp_filters']['bit_connect_capabilities']);
        }

        $this->assertTrue(get_role('administrator')->capabilities[$extra] ?? false);
        $this->assertTrue(get_role('administrator')->capabilities['bit_connect_forum_manage'] ?? false);
        $this->assertArrayNotHasKey('bit_connect_caps_reapply', $GLOBALS['__wp_options']);
    }

    public function testApplyAfterActivationDoesNothingUnlessRequested(): void
    {
        $this->addRole('administrator', 'Administrator', ['manage_options' => true]);
        $GLOBALS['__wp_options']['bit_connect_capability_settings'] = [
            'administrator' => Capabilities::capMap(Capabilities::adminCaps()),
        ];

        CapabilityService::applyAfterActivation();

        $this->assertArrayNotHasKey('bit_connect_forum_manage', get_role('administrator')->capabilities);
    }
}
