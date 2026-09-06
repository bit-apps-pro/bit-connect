<?php

namespace BitApps\BitConnect\Tests\Services;

use BitApps\BitConnect\Services\AuthService;
use PHPUnit\Framework\TestCase;
use WP_Role;
use WP_Roles;

class RegistrationRoleTest extends TestCase
{
    private WP_Roles $wpRoles;

    protected function setUp(): void
    {
        $this->wpRoles           = new WP_Roles();
        $GLOBALS['__wp_roles']   = $this->wpRoles;
        $GLOBALS['__wp_options'] = [];
    }

    private function addRole(string $slug, string $name, array $caps): void
    {
        $role = new WP_Role($name, $caps);
        $ref  = new \ReflectionProperty(WP_Roles::class, 'roles');
        $ref->setAccessible(true);
        $all        = $ref->getValue($this->wpRoles);
        $all[$slug] = $role;
        $ref->setValue($this->wpRoles, $all);
    }

    public function testAssignableRolesExcludesAdminCapableRoles(): void
    {
        $this->addRole('administrator', 'Administrator', ['manage_options' => true, 'read' => true]);
        $this->addRole('editor', 'Editor', ['edit_others_posts' => true, 'read' => true]);
        $this->addRole('subscriber', 'Subscriber', ['read' => true]);

        $values = array_column(AuthService::assignableRoles(), 'value');

        $this->assertNotContains('administrator', $values, 'admin-capable roles must not be assignable');
        $this->assertContains('editor', $values);
        $this->assertContains('subscriber', $values);
    }

    public function testDefaultRegistrationRolePrefersSubscriber(): void
    {
        $this->addRole('administrator', 'Administrator', ['manage_options' => true]);
        $this->addRole('editor', 'Editor', ['edit_others_posts' => true]);
        $this->addRole('subscriber', 'Subscriber', ['read' => true]);

        $this->assertSame('subscriber', AuthService::defaultRegistrationRole());
    }

    public function testDefaultFallsBackWhenNoSubscriber(): void
    {
        $this->addRole('editor', 'Editor', ['edit_others_posts' => true]);
        $GLOBALS['__wp_options']['default_role'] = 'editor';

        $this->assertSame('editor', AuthService::defaultRegistrationRole());
    }

    public function testSanitizeAcceptsAssignableRole(): void
    {
        $this->addRole('editor', 'Editor', ['edit_others_posts' => true]);
        $this->addRole('subscriber', 'Subscriber', ['read' => true]);

        $this->assertSame('editor', AuthService::sanitizeRegistrationRole('editor'));
    }

    public function testSanitizeRejectsAdminRoleAndFallsBackToDefault(): void
    {
        $this->addRole('administrator', 'Administrator', ['manage_options' => true]);
        $this->addRole('subscriber', 'Subscriber', ['read' => true]);

        // Attempting to escalate registrations to administrator is rejected.
        $this->assertSame('subscriber', AuthService::sanitizeRegistrationRole('administrator'));
    }

    public function testSanitizeRejectsUnknownRole(): void
    {
        $this->addRole('subscriber', 'Subscriber', ['read' => true]);

        $this->assertSame('subscriber', AuthService::sanitizeRegistrationRole('does_not_exist'));
    }
}
