<?php

namespace BitApps\BitConnect\Providers;

// Prevent direct script access
if (!defined('ABSPATH')) {
    exit;
}


use BitApps\BitConnect\Config;
use BitApps\BitConnect\Deps\BitApps\WPDatabase\Connection;
use BitApps\BitConnect\Deps\BitApps\WPKit\Hooks\Hooks;
use BitApps\BitConnect\Deps\BitApps\WPKit\Installer;
use BitApps\BitConnect\Enum\AdminSettings;
use BitApps\BitConnect\Enum\PostTypes;
use BitApps\BitConnect\Enum\Taxonomies;
use BitApps\BitConnect\Http\Controller\PortalSlugController;
use BitApps\BitConnect\Services\AuthService;

final class InstallerProvider
{
    private $_activateHook;

    private $_deactivateHook;

    private static $_uninstallHook;

    public function __construct()
    {
        register_activation_hook(Config::get('MAIN_FILE'), [$this, 'registerActivator']);
        register_deactivation_hook(Config::get('MAIN_FILE'), [$this, 'registerDeactivator']);
        $this->_activateHook = Config::withPrefix('activate');
        $this->_deactivateHook = Config::withPrefix('deactivate');
        self::$_uninstallHook = Config::withPrefix('uninstall');

        Hooks::addAction($this->_deactivateHook, [$this, 'deactivate']);

        // Only a static class method or function can be used in an uninstall hook.
        register_uninstall_hook(Config::get('MAIN_FILE'), [self::class, 'registerUninstaller']);
    }

    public function register()
    {
        $installer = new Installer(
            [
                'php'        => Config::REQUIRED_PHP_VERSION,
                'wp'         => Config::REQUIRED_WP_VERSION,
                'version'    => Config::VERSION,
                'oldVersion' => Config::getOption('version', '0.0'),
                'multisite'  => true,
                'basename'   => Config::get('BASENAME'),
            ],
            [
                'activate'  => $this->_activateHook,
                'uninstall' => self::$_uninstallHook,
            ],
            [

                'migration' => $this->migration(),
                'drop'      => $this->drop(),
            ]
        );
        $installer->register();
    }

    public function deactivate()
    {
        wp_clear_scheduled_hook(Config::VAR_PREFIX . 'flow_history_cleanup');
        // The digest and retention jobs. Without this the schedule outlives the
        // plugin: WordPress keeps firing hooks nothing listens to, and a later
        // reactivation adds a second copy beside the orphan.
        CronProvider::clear();
        flush_rewrite_rules();
    }

    public function registerActivator($networkWide)
    {
        AuthService::registerCustomRole();
        PortalSlugController::ensurePortalTemplate();
        Hooks::doAction($this->_activateHook, $networkWide);
    }

    public function registerDeactivator($networkWide)
    {
        AuthService::removeCustomRole();
        Hooks::doAction($this->_deactivateHook, $networkWide);
    }

    public static function registerUninstaller()
    {
        if (!self::shouldDeleteDataOnUninstall()) {
            return;
        }

        self::deletePortalPage();
        self::deletePluginPosts();
        self::deletePluginTerms();
        self::deletePluginTaxonomies();
        self::deletePluginOptions();
        AuthService::removeCustomRole();
        Hooks::doAction(self::$_uninstallHook);
    }

    /**
     * Migration classes, in the order they must run.
     *
     * These are the plugin's only global-namespace classes — MigrationHelper
     * resolves each name to `<path><Name>.php` and instantiates it, so they
     * cannot live under `BitApps\BitConnect`. That puts them in front of the
     * WordPress.org prefix check, which wants a literal `bit_connect` prefix
     * and infers nothing from the namespace the rest of the plugin uses. Hence
     * `Bit_Connect_` here rather than the PascalCase used everywhere else.
     */
    public static function migration()
    {
        $migrations = [
            'Bit_Connect_PluginOptions',
            'Bit_Connect_Votes',
            'Bit_Connect_ActivityLog',
            // After the table it reads, and last of the activity pair: it
            // deletes rows rather than shaping the schema.
            'Bit_Connect_PurgeEditActivity',
            'Bit_Connect_Reports',
            'Bit_Connect_Follows',
            'Bit_Connect_Notifications',
        ];

        return [
            'path' => Config::get('BASEDIR')
                . DIRECTORY_SEPARATOR
                . 'db'
                . DIRECTORY_SEPARATOR
                . 'Migrations'
                . DIRECTORY_SEPARATOR,
            'migrations' => $migrations,
        ];
    }

    public static function drop()
    {
        $migrations = [
            'Bit_Connect_PluginOptions',
            'Bit_Connect_Votes',
            'Bit_Connect_ActivityLog',
            'Bit_Connect_Reports',
            'Bit_Connect_Follows',
            'Bit_Connect_Notifications',
        ];

        return [
            'path' => Config::get('BASEDIR')
                . DIRECTORY_SEPARATOR
                . 'db'
                . DIRECTORY_SEPARATOR
                . 'Migrations'
                . DIRECTORY_SEPARATOR,
            'migrations' => $migrations,
        ];
    }

    public static function deletePortalPage()
    {
        // Delete the portal template
        $existingTemplates = get_posts(
            [
                'name'        => 'bit-connect-portal',
                'numberposts' => -1,
                'post_type'   => 'wp_template',
                'post_status' => 'any',
            ]
        );

        foreach ($existingTemplates as $template) {
            wp_delete_post($template->ID, true);
        }
    }

    /**
     * Public so the cleanup can be exercised, like deletePortalPage() above.
     * Uninstall code runs once, on a site whose owner has already gone, so a
     * test is the only place it is ever seen to work.
     */
    public static function deletePluginPosts()
    {
        $topicPostIds = get_posts(
            [
                'fields'           => 'ids',
                'numberposts'      => -1,
                'post_type'        => PostTypes::BIT_CONNECT->value,
                'post_status'      => 'any',
                'suppress_filters' => false,
            ]
        );

        foreach ($topicPostIds as $postId) {
            wp_delete_post((int) $postId, true);
        }

        foreach (self::portalPageSlugs() as $slug) {
            $portalPages = get_posts(
                [
                    'fields'      => 'ids',
                    'name'        => $slug,
                    'numberposts' => -1,
                    'post_type'   => 'page',
                    'post_status' => 'any',
                ]
            );

            foreach ($portalPages as $portalPageId) {
                wp_delete_post((int) $portalPageId, true);
            }
        }
    }

    /**
     * Every slug the portal page might be under.
     *
     * The stored slug comes first and is the one that matters: `portal_page`
     * is written by PortalSlugController whenever the page is created or moved,
     * and the onboarding wizard routinely sets something else entirely. This
     * used to look for the literal 'portal' and nothing else, so on any site
     * whose portal had been named — which is most of them — the page outlived
     * an uninstall that promised to remove it.
     *
     * 'portal' is kept as a fallback rather than dropped: a site old enough to
     * predate the option, or one whose option was lost, still has its default
     * page cleaned up.
     *
     * @return array<int, string>
     */
    public static function portalPageSlugs(): array
    {
        $stored = Config::getOption('portal_page', '');
        $stored = \is_string($stored) ? trim($stored, '/ ') : '';

        return array_values(array_unique(array_filter([$stored, 'portal'])));
    }

    /**
     * Whether an option belongs to this plugin and is ours to remove.
     *
     * The pro add-on namespaces its options under `bit_connect_pro_`, which
     * begins with this plugin's own `bit_connect_` — so a plain prefix sweep
     * takes the add-on's data with it, licence key included. It has its own
     * uninstaller registered against its own plugin file and cleans up after
     * itself; this one must leave it alone.
     *
     * That mattered in practice rather than in theory: `Requires Plugins`
     * makes an admin deactivate pro before removing free, so the add-on would
     * still be sitting installed on disk with its licence silently deleted,
     * and would come back unlicensed on reactivation.
     */
    public static function ownsOption(string $optionName): bool
    {
        if (strpos($optionName, Config::withPrefix('')) !== 0) {
            return false;
        }

        return strpos($optionName, Config::withPrefix('pro_')) !== 0;
    }

    private static function shouldDeleteDataOnUninstall()
    {
        $settings = Config::getOption(AdminSettings::OPTION_NAME->value, []);

        if (!\is_array($settings) || !isset($settings['cleanup']) || !\is_array($settings['cleanup'])) {
            return false;
        }

        return !empty($settings['cleanup']['deleteDataOnUninstall']);
    }

    private static function deletePluginTerms()
    {
        $wpdbTermRelationships = Connection::prop('term_relationships');
        $wpdbTermTaxonomy = Connection::prop('term_taxonomy');
        $wpdbTermmeta = Connection::prop('termmeta');
        $wpdbTerms = Connection::prop('terms');

        foreach (self::getPluginTaxonomies() as $taxonomy) {
            $termTaxonomyIds = Connection::get_col(
                Connection::prepare(
                    "SELECT term_taxonomy_id FROM {$wpdbTermTaxonomy} WHERE taxonomy = %s",
                    $taxonomy
                )
            );

            if (empty($termTaxonomyIds)) {
                continue;
            }

            $termTaxonomyIds = array_map('intval', $termTaxonomyIds);
            $inPlaceholders = implode(',', array_fill(0, \count($termTaxonomyIds), '%d'));

            $termIds = Connection::get_col(
                Connection::prepare(
                    "SELECT DISTINCT term_id FROM {$wpdbTermTaxonomy} WHERE term_taxonomy_id IN ({$inPlaceholders})",
                    ...$termTaxonomyIds
                )
            );

            Connection::query(
                Connection::prepare(
                    "DELETE FROM {$wpdbTermRelationships} WHERE term_taxonomy_id IN ({$inPlaceholders})",
                    ...$termTaxonomyIds
                )
            );
            Connection::query(
                Connection::prepare(
                    "DELETE FROM {$wpdbTermTaxonomy} WHERE term_taxonomy_id IN ({$inPlaceholders})",
                    ...$termTaxonomyIds
                )
            );

            if (!empty($termIds)) {
                $termIds = array_map('intval', $termIds);
                $termPlaceholders = implode(',', array_fill(0, \count($termIds), '%d'));

                Connection::query(
                    Connection::prepare(
                        "DELETE FROM {$wpdbTermmeta} WHERE term_id IN ({$termPlaceholders})",
                        ...$termIds
                    )
                );

                // Delete terms that are no longer linked to any taxonomy.
                Connection::query(
                    Connection::prepare(
                        "DELETE t FROM {$wpdbTerms} t
                        LEFT JOIN {$wpdbTermTaxonomy} tt ON t.term_id = tt.term_id
                        WHERE tt.term_id IS NULL AND t.term_id IN ({$termPlaceholders})",
                        ...$termIds
                    )
                );
            }
        }
    }

    private static function deletePluginTaxonomies()
    {
        foreach (self::getPluginTaxonomies() as $taxonomy) {
            if (\function_exists('unregister_taxonomy') && taxonomy_exists($taxonomy)) {
                unregister_taxonomy($taxonomy);
            }
        }
    }

    private static function getPluginTaxonomies()
    {
        return [
            Taxonomies::TOPIC_TYPES->value,
            Taxonomies::DEPARTMENTS->value,
            Taxonomies::STAGES->value,
            Taxonomies::STATUSES->value,
            Taxonomies::TAGS->value,
        ];
    }

    private static function deletePluginOptions()
    {
        $wpdbOptions = Connection::prop('options');

        // Mirrors ownsOption() below — keep the two in step.
        Connection::query(
            Connection::prepare(
                "DELETE FROM {$wpdbOptions} WHERE option_name LIKE %s AND option_name NOT LIKE %s",
                Connection::esc_like(Config::withPrefix('')) . '%',
                Connection::esc_like(Config::withPrefix('pro_')) . '%'
            )
        );
    }
}
