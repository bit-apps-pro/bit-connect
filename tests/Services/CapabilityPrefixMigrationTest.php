<?php

namespace BitApps\BitConnect\Tests\Services;

use BitApps\BitConnect\Services\CapabilityService;
use PHPUnit\Framework\TestCase;
use ReflectionProperty;
use WP_Role;
use WP_Roles;

/**
 * The capability slugs moved from `forum_*` to `bit_connect_forum_*`. A site
 * that already granted them keeps every grant: on roles, in the saved
 * settings, and — through the same rule — for slugs another plugin declared
 * under the old convention. The withdrawn slug is the one thing left behind.
 *
 * @internal
 *
 * @coversNothing
 */
final class CapabilityPrefixMigrationTest extends TestCase
{
    private WP_Roles $wpRoles;

    protected function setUp(): void
    {
        $this->wpRoles = new WP_Roles();
        $GLOBALS['__wp_roles'] = $this->wpRoles;
        $GLOBALS['__wp_options'] = [];
        $GLOBALS['__wp_user_meta'] = [];
        $GLOBALS['__wp_users'] = [];
    }

    public function testRenamesEveryGrantOnARole(): void
    {
        $this->addRole('editor', 'Editor', [
            'read'                     => true,
            'forum_create_post'        => true,
            'forum_moderate'           => false,
            'forum_vote_comment'       => true,
            'bit_connect_forum_manage' => true,
        ]);

        $changed = CapabilityService::migratePrefixedSlugs();

        $this->assertSame(1, $changed);
        $this->assertSame(
            [
                'read'                           => true,
                'bit_connect_forum_manage'       => true,
                'bit_connect_forum_create_post'  => true,
                'bit_connect_forum_moderate'     => false,
                'bit_connect_forum_vote_comment' => true,
            ],
            get_role('editor')->capabilities
        );
    }

    public function testLeavesTheWithdrawnSlugAlone(): void
    {
        $this->addRole('editor', 'Editor', ['forum_edit_any' => true]);

        CapabilityService::migratePrefixedSlugs();

        $this->assertSame(['forum_edit_any' => true], get_role('editor')->capabilities);
    }

    public function testRenamesTheSavedSettings(): void
    {
        $this->addRole('subscriber', 'Subscriber', ['read' => true]);
        update_option('bit_connect_capability_settings', [
            'subscriber' => ['forum_create_post' => true, 'forum_vote_post' => false],
        ]);

        CapabilityService::migratePrefixedSlugs();

        $this->assertSame(
            ['subscriber' => ['bit_connect_forum_create_post' => true, 'bit_connect_forum_vote_post' => false]],
            get_option('bit_connect_capability_settings')
        );
    }

    public function testRunsOnce(): void
    {
        $this->addRole('editor', 'Editor', ['forum_manage' => true]);

        CapabilityService::migratePrefixedSlugs();
        get_role('editor')->add_cap('forum_manage', true);

        $this->assertSame(0, CapabilityService::migratePrefixedSlugs());
        $this->assertArrayHasKey('forum_manage', get_role('editor')->capabilities);
    }

    private function addRole(string $slug, string $name, array $caps): void
    {
        $role = new WP_Role($name, $caps);
        $ref = new ReflectionProperty(WP_Roles::class, 'roles');
        $ref->setAccessible(true);
        $all = $ref->getValue($this->wpRoles);
        $all[$slug] = $role;
        $ref->setValue($this->wpRoles, $all);
    }
}
