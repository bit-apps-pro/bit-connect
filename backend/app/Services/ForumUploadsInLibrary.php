<?php

namespace BitApps\BitConnect\Services;

// Prevent direct script access
if (!defined('ABSPATH')) {
    exit;
}

use BitApps\BitConnect\Deps\BitApps\WPKit\Hooks\Hooks;
use WP_Query;

/**
 * Keeps what members upload in the forum out of the site's Media Library.
 *
 * Every picture, video and file a member posts is an attachment, which is what
 * gives it resized copies, a link to its topic, the unused-upload cleanup and
 * deletion with its post. It also put every screenshot from every bug report
 * into the library the site's own pages are built from, and into the picker an
 * editor inserts media with.
 *
 * Those uploads carry UploadClaims::PORTAL_META, so they are left out of both
 * the library and the picker, and kept a click away: the list view gets a
 * "Bit Connect uploads" link beside its filters that shows them and nothing else.
 * A query that names its posts or their parent still finds them, so a topic's
 * own media and an editor reopening a gallery are not cut short. Uploads from
 * before the mark existed carry none and stay listed.
 */
final class ForumUploadsInLibrary
{
    /** The list view's query argument that shows forum uploads only. */
    public const VIEW_ARG = 'bit_connect_uploads';

    public static function register(): void
    {
        Hooks::addFilter('ajax_query_attachments_args', [self::class, 'filterPickerQuery']);
        Hooks::addAction('pre_get_posts', [self::class, 'filterListQuery']);
        Hooks::addFilter('views_upload', [self::class, 'addView']);
    }

    /**
     * The library grid and every media picker load through this query.
     *
     * @param array<string, mixed> $args
     *
     * @return array<string, mixed>
     */
    public static function filterPickerQuery($args): array
    {
        $args = \is_array($args) ? $args : [];

        if (!empty($args['post__in']) || !empty($args['post_parent'])) {
            return $args;
        }

        return self::withMeta($args, 'NOT EXISTS');
    }

    /**
     * The library's list view: forum uploads hidden, or alone under their view.
     */
    public static function filterListQuery(WP_Query $query): void
    {
        if (!is_admin() || !$query->is_main_query() || ($GLOBALS['pagenow'] ?? '') !== 'upload.php') {
            return;
        }

        $metaQuery = $query->get('meta_query');
        $args = self::withMeta(
            ['meta_query' => \is_array($metaQuery) ? $metaQuery : []],
            self::isViewing() ? 'EXISTS' : 'NOT EXISTS'
        );

        $query->set('meta_query', $args['meta_query']);
    }

    /**
     * The "Bit Connect uploads" link core shows beside the list view's filters.
     *
     * @param array<string, string> $views
     *
     * @return array<string, string>
     */
    public static function addView($views): array
    {
        $views = \is_array($views) ? $views : [];
        $current = self::isViewing();

        $views['bit-connect-uploads'] = \sprintf(
            '<a href="%s"%s>%s</a>',
            esc_url(add_query_arg(['mode' => 'list', self::VIEW_ARG => 1], admin_url('upload.php'))),
            $current ? ' class="current" aria-current="page"' : '',
            esc_html__('Bit Connect uploads', 'bit-connect')
        );

        return $views;
    }

    /**
     * Add the forum-upload condition beside whatever the query already asks.
     *
     * @param array<string, mixed> $args
     *
     * @return array<string, mixed>
     */
    public static function withMeta(array $args, string $compare): array
    {
        $existing = isset($args['meta_query']) && \is_array($args['meta_query']) ? $args['meta_query'] : [];
        $condition = ['key' => UploadClaims::PORTAL_META, 'compare' => $compare];

        $args['meta_query'] = $existing === []
            ? [$condition]
            : ['relation' => 'AND', $existing, $condition];

        return $args;
    }

    private static function isViewing(): bool
    {
        // A read-only view switch, like core's own `attachment-filter`: nothing
        // is changed by it, so there is no nonce to check.
        // phpcs:ignore WordPress.Security.NonceVerification.Recommended
        return !empty($_GET[self::VIEW_ARG]);
    }
}
