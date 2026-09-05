<?php

declare(strict_types=1);

namespace BitApps\BitConnect\Providers;

use BitApps\BitConnect\Deps\BitApps\WPKit\Hooks\Hooks;
use BitApps\BitConnect\Enum\DefaultValues;
use BitApps\BitConnect\Enum\PostTypes;
use BitApps\BitConnect\Enum\Taxonomies;
use BitApps\BitConnect\Services\ContentVisibilityService;
use BitApps\BitConnect\Services\DefaultTermService;
use BitApps\BitConnect\Services\StageService;
use BitApps\BitConnect\Services\StatusService;
use BitApps\BitConnect\Services\TermOrderService;
use WP_Post;

// Prevent direct script access
if (!\defined('ABSPATH')) {
    exit;
}

/**
 * PostTypeProvider class.
 *
 * Handles registration of custom post types and taxonomies for Bit Connect plugin.
 */
class PostTypeProvider
{
    /**
     * PostTypeProvider constructor.
     */
    public function __construct()
    {
        $this->registerPostType();
        $this->registerTaxonomies();
        $this->addTermMetaField();
        $this->preventDefaultStatusDeletion();
        $this->restrictEditingToAuthor();
    }

    /**
     * Nobody but the author edits a topic — including through wp-admin.
     *
     * PermissionService answers for the portal and this plugin's own routes,
     * and neither of them is the only way in. The post type registers with
     * capability_type 'post', so every WordPress administrator holds
     * edit_others_posts and could open any member's topic in the block editor,
     * or PUT it through core's /wp/v2 route, and rewrite it under that member's
     * name. Both paths resolve the edit_post meta capability, which is why one
     * filter closes them together.
     *
     * Scoped to editing on purpose. delete_post is untouched: forum_delete_any
     * is a capability this forum still grants, and an administrator being able
     * to remove content is not the thing being prevented here.
     *
     * Plugin code is unaffected — wp_update_post() performs no capability check
     * of its own, so hiding, restoring, pinning and locking all still work.
     */
    public function restrictEditingToAuthor(): void
    {
        Hooks::addFilter('map_meta_cap', [$this, 'denyEditingOthersTopics'], 10, 4);
    }

    /**
     * Maps edit_post on somebody else's topic to do_not_allow.
     *
     * @param array<int, string> $caps   primitive capabilities required so far
     * @param string             $cap    the meta capability being resolved
     * @param int                $userId the user it is being resolved for
     * @param array<int, mixed>  $args   $args[0] is the post id for edit_post
     *
     * @return array<int, string>
     */
    public function denyEditingOthersTopics(array $caps, string $cap, int $userId, array $args): array
    {
        if ($cap !== 'edit_post' || $args === []) {
            return $caps;
        }

        $post = get_post((int) $args[0]);

        if (!$post instanceof WP_Post || $post->post_type !== PostTypes::BIT_CONNECT->value) {
            return $caps;
        }

        // Authorship decides it, and the author still has to satisfy whatever
        // core already required of them — this only ever takes away.
        if ((int) $post->post_author === $userId) {
            return $caps;
        }

        return ['do_not_allow'];
    }

    /**
     * Register the bit-connect custom post type.
     */
    public function registerPostType(): void
    {
        $labels = [
            'name'          => _x('Bit Connect Posts', 'Post Type General Name', 'bit-connect'),
            'singular_name' => _x('Bit Connect Post', 'Post Type Singular Name', 'bit-connect'),
        ];

        /**
         * Arguments for registering the post type.
         *
         * @var array<string, mixed> $args
         */
        $args = [
            'label'                 => __('Bit Connect Post', 'bit-connect'),
            'description'           => __('Bit Connect custom post type', 'bit-connect'),
            'labels'                => $labels,
            'supports'              => ['title', 'editor', 'excerpt', 'thumbnail', 'comments', 'revisions', 'custom-fields'],
            'rest_base'             => PostTypes::BIT_CONNECT->value,
            'rest_controller_class' => 'WP_REST_Posts_Controller',
            'rewrite'               => ['slug' => PostTypes::BIT_CONNECT->value],
            'public'                => true,
            'publicly_queryable'    => true,
            'show_ui'               => true,
            'show_in_menu'          => false,
            'show_in_nav_menus'     => true,
            'show_in_rest'          => true,
            'taxonomies'            => [
                Taxonomies::TOPIC_TYPES->value,
                Taxonomies::DEPARTMENTS->value,
                Taxonomies::STAGES->value,
                Taxonomies::STATUSES->value,
                Taxonomies::TAGS->value,
            ],
            'capability_type' => 'post',
        ];


        register_post_type(PostTypes::BIT_CONNECT->value, $args);

        // Registered with the post type so it exists before any query names it.
        // A topic in this status is excluded from every WP_Query that does not
        // ask for it, which is every query in this plugin.
        ContentVisibilityService::registerPostStatus();

        add_post_type_support(PostTypes::BIT_CONNECT->value, 'comments');
    }

    /**
     * Register all taxonomies for the bit-connect post type.
     */
    public function registerTaxonomies(): void
    {
        $this->registerTaxonomy(Taxonomies::TOPIC_TYPES->value, 'Topic Type', 'Topic Types', true);
        $this->registerTaxonomy(Taxonomies::DEPARTMENTS->value, 'Department', 'Departments', true);
        $this->registerTaxonomy(Taxonomies::STAGES->value, 'Stage', 'Stages', true);
        $this->registerTaxonomy(Taxonomies::STATUSES->value, 'Status', 'Statuses', true);
        $this->registerTaxonomy(Taxonomies::TAGS->value, 'Tag', 'Tags', false);

        // Create default stages after registration
        $this->createDefaultStages();
        $this->createDefaultStatuses();
    }

    /**
     * Create default stages if they don't exist.
     */
    public function createDefaultStages(): void
    {
        if (!taxonomy_exists(Taxonomies::STAGES->value)) {
            return;
        }

        DefaultTermService::ensure(
            Taxonomies::STAGES->value,
            StageService::DEFAULT_META_KEY,
            DefaultValues::STAGE->value,
            __('Questions', 'bit-connect')
        );
    }

    public function createDefaultStatuses(): void
    {
        if (!taxonomy_exists(Taxonomies::STATUSES->value)) {
            return;
        }

        DefaultTermService::ensure(
            Taxonomies::STATUSES->value,
            StatusService::DEFAULT_META_KEY,
            DefaultValues::STATUS->value,
            __('Need Approval', 'bit-connect')
        );
    }

    /**
     * Add term meta fields to the taxonomies.
     */
    public function addTermMetaField(): void
    {
        register_term_meta(
            Taxonomies::STATUSES->value,
            'color',
            [
                'show_in_rest'      => true,
                'single'            => true,
                'sanitize_callback' => 'sanitize_text_field',
                'type'              => 'string',
            ]
        );

        register_term_meta(
            Taxonomies::STATUSES->value,
            'icon_url',
            [
                'type'              => 'string',
                'single'            => true,
                'sanitize_callback' => 'sanitize_text_field',
                'show_in_rest'      => true,
            ]
        );

        register_term_meta(
            Taxonomies::STATUSES->value,
            'icon_id',
            [
                'type'              => 'integer',
                'single'            => true,
                'sanitize_callback' => 'absint',
                'show_in_rest'      => true,
            ]
        );

        register_term_meta(
            Taxonomies::TOPIC_TYPES->value,
            'color',
            [
                'show_in_rest'      => true,
                'single'            => true,
                'sanitize_callback' => 'sanitize_text_field',
                'type'              => 'string',
            ]
        );

        register_term_meta(
            Taxonomies::STAGES->value,
            'icon_url',
            [
                'type'              => 'string',
                'single'            => true,
                'sanitize_callback' => 'sanitize_text_field',
                'show_in_rest'      => true,
            ]
        );

        register_term_meta(
            Taxonomies::STAGES->value,
            'icon_id',
            [
                'type'              => 'integer',
                'single'            => true,
                'sanitize_callback' => 'absint',
                'show_in_rest'      => true,
            ]
        );

        // Admin-defined position, written by TaxonomyController::reorder(). A
        // term without it has never been dragged and sorts last — see
        // TermOrderService::sort().
        foreach (TermOrderService::orderableTaxonomies() as $orderableTaxonomy) {
            register_term_meta(
                $orderableTaxonomy,
                TermOrderService::ORDER_META_KEY,
                [
                    'type'              => 'integer',
                    'single'            => true,
                    'sanitize_callback' => 'absint',
                    'show_in_rest'      => true,
                ]
            );
        }

        // Marks the protected default term of its taxonomy. Readable so the
        // admin can grey out the delete button; plugin-managed, so REST clients
        // cannot set it.
        foreach ([Taxonomies::STAGES->value, Taxonomies::STATUSES->value] as $defaultableTaxonomy) {
            register_term_meta(
                $defaultableTaxonomy,
                StageService::DEFAULT_META_KEY,
                [
                    'type'          => 'boolean',
                    'single'        => true,
                    'show_in_rest'  => true,
                    'auth_callback' => '__return_false',
                ]
            );
        }

        register_term_meta(
            Taxonomies::TOPIC_TYPES->value,
            'icon_url',
            [
                'type'              => 'string',
                'single'            => true,
                'sanitize_callback' => 'sanitize_text_field',
                'show_in_rest'      => true,
            ]
        );

        register_term_meta(
            Taxonomies::TOPIC_TYPES->value,
            'icon_id',
            [
                'type'              => 'integer',
                'single'            => true,
                'sanitize_callback' => 'absint',
                'show_in_rest'      => true,
            ]
        );

        $this->addIconDarkTermMetaFields();
    }

    /**
     * Prevent deletion of the default status or stage term.
     */
    public function preventDefaultStatusDeletion(): void
    {
        // TODO: Check if the filter is already registered to prevent duplicate registration
        Hooks::addFilter(
            'user_has_cap',
            function ($allcaps, $caps, $args, $user) { // phpcs:ignore VariableAnalysis.CodeAnalysis.VariableAnalysis.UnusedVariable
                if (!isset($args[0]) || $args[0] !== 'delete_term') {
                    return $allcaps;
                }

                if (!isset($args[2])) {
                    return $allcaps;
                }

                $term_id = $args[2];
                $term = get_term($term_id);

                if (!$term || is_wp_error($term)) {
                    return $allcaps;
                }

                if ($term->taxonomy !== Taxonomies::STATUSES->value && $term->taxonomy !== Taxonomies::STAGES->value) {
                    return $allcaps;
                }

                // Both carry a flag rather than a reserved slug, so the default
                // term stays protected after it is renamed.
                if (StageService::isDefault($term) || StatusService::isDefault($term)) {
                    $allcaps['manage_categories'] = false;
                }

                return $allcaps;
            },
            10,
            4
        );
    }

    /**
     * Optional dark-theme counterpart to the `icon_url`/`icon_id` pair above.
     *
     * A stage icon is admin-uploaded artwork, and an icon-set glyph is usually
     * pure black — barely visible against the dark portal surface. These let an
     * admin supply a second file for that case. Left unset, the light icon is
     * used in both themes, so every existing term keeps working untouched.
     */
    private function addIconDarkTermMetaFields(): void
    {
        $iconTaxonomies = [
            Taxonomies::STAGES->value,
            Taxonomies::STATUSES->value,
            Taxonomies::TOPIC_TYPES->value,
        ];

        foreach ($iconTaxonomies as $taxonomy) {
            register_term_meta(
                $taxonomy,
                'icon_dark_url',
                [
                    'type'              => 'string',
                    'single'            => true,
                    'sanitize_callback' => 'sanitize_text_field',
                    'show_in_rest'      => true,
                ]
            );

            register_term_meta(
                $taxonomy,
                'icon_dark_id',
                [
                    'type'              => 'integer',
                    'single'            => true,
                    'sanitize_callback' => 'absint',
                    'show_in_rest'      => true,
                ]
            );
        }
    }

    /**
     * Register a taxonomy for the bit-connect post type.
     *
     * @param string $taxonomy    taxonomy slug/identifier
     * @param string $singular    singular name for the taxonomy
     * @param string $plural      plural name for the taxonomy
     * @param bool   $hierarchical whether the taxonomy is hierarchical
     */
    private function registerTaxonomy(string $taxonomy, string $singular, string $plural, bool $hierarchical): void
    {
        $labels = [
            // phpcs:ignore WordPress.WP.I18n.NonSingularStringLiteralText
            'name' => _x($plural, 'Taxonomy General Name', 'bit-connect'),
            // phpcs:ignore WordPress.WP.I18n.NonSingularStringLiteralText
            'singular_name' => _x($singular, 'Taxonomy Singular Name', 'bit-connect'),
        ];

        /**
         * Arguments for registering the taxonomy.
         *
         * @var array<string, mixed> $args
         */
        $args = [
            'labels'                => $labels,
            'hierarchical'          => $hierarchical,
            'show_in_rest'          => true,
            'rest_base'             => $taxonomy,
            'rest_controller_class' => 'WP_REST_Terms_Controller',
            'rewrite'               => [
                'slug' => $taxonomy,
            ],
        ];

        register_taxonomy($taxonomy, [PostTypes::BIT_CONNECT->value], $args);
    }
}
