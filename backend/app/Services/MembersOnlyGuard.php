<?php

namespace BitApps\BitConnect\Services;

// Prevent direct script access
if (!defined('ABSPATH')) {
    exit;
}

use BitApps\BitConnect\Deps\BitApps\WPKit\Hooks\Hooks;
use BitApps\BitConnect\Enum\PostTypes;
use BitApps\BitConnect\Enum\Taxonomies;
use WP_Error;
use WP_Query;
use WP_REST_Request;

/**
 * Keeps a members-only forum closed on the doors WordPress opens by itself.
 *
 * PortalAccess closes the plugin's own routes, but the topic post type is
 * registered public and `show_in_rest`, so core serves the same topics without
 * asking it: `/wp/v2/bit-connect`, the topic taxonomies and their comments over
 * REST, the RSS feeds, the site search, the taxonomy archives and oEmbed. Every
 * one of those answered a logged-out visitor with titles and bodies while the
 * portal showed them a sign-in prompt.
 *
 * Closed at request time rather than by re-registering the post type when the
 * setting changes: that would need a rewrite flush on every switch, and would
 * take the editor and admin screens away from the logged-in people who still
 * need them. Nothing here does anything while PortalAccess::canView() is true,
 * so an open forum, and every logged-in visitor, sees core's usual behaviour —
 * including its own rules for private topics.
 */
final class MembersOnlyGuard
{
    private const REST_NAMESPACE = '/wp/v2/';

    public static function register(): void
    {
        Hooks::addFilter('rest_pre_dispatch', [self::class, 'refuseRestRoute'], 10, 3);
        Hooks::addFilter('rest_comment_query', [self::class, 'withoutTopicComments']);
        Hooks::addFilter('rest_post_search_query', [self::class, 'withoutTopicsInSearch']);
        Hooks::addFilter('oembed_request_post_id', [self::class, 'refuseOembed']);
        Hooks::addFilter('comment_feed_where', [self::class, 'withoutTopicCommentsInFeed']);
        Hooks::addAction('pre_get_posts', [self::class, 'restrictMainQuery']);
    }

    /**
     * Refuse the core REST routes that serve topics, their terms and their
     * comments.
     *
     * @param mixed           $result
     * @param mixed           $server
     * @param WP_REST_Request $request
     *
     * @return mixed
     */
    public static function refuseRestRoute($result, $server, $request)
    {
        if ($result !== null || !$request instanceof WP_REST_Request || PortalAccess::canView()) {
            return $result;
        }

        if (!self::isClosedRoute((string) $request->get_route(), (array) $request->get_params())) {
            return $result;
        }

        return new WP_Error('rest_forbidden', PortalAccess::deniedMessage(), ['status' => 401]);
    }

    /**
     * Whether a core REST route reads topic content.
     *
     * A comment route is closed when it names a topic — by the comment's own
     * post, or by the `post` filter on the list. The unfiltered list stays open
     * and has topics taken out of it by withoutTopicComments().
     *
     * @param array<string, mixed> $params
     */
    public static function isClosedRoute(string $route, array $params): bool
    {
        foreach (self::restBases() as $base) {
            $prefix = self::REST_NAMESPACE . $base;

            if ($route === $prefix || strpos($route, $prefix . '/') === 0) {
                return true;
            }
        }

        if (preg_match('#^/wp/v2/comments/(\d+)$#', $route, $match) === 1) {
            $comment = get_comment((int) $match[1]);

            return $comment !== null && self::isTopic((int) $comment->comment_post_ID);
        }

        if ($route === self::REST_NAMESPACE . 'comments' && isset($params['post'])) {
            foreach ((array) $params['post'] as $postId) {
                if (self::isTopic((int) $postId)) {
                    return true;
                }
            }
        }

        return false;
    }

    /**
     * Take topic comments out of the unfiltered `/wp/v2/comments` list.
     *
     * @param mixed $args
     *
     * @return mixed
     */
    public static function withoutTopicComments($args)
    {
        if (!\is_array($args) || PortalAccess::canView()) {
            return $args;
        }

        $args['post_type'] = self::otherTypes(get_post_types(['public' => true]));

        return $args;
    }

    /**
     * Take topics out of `/wp/v2/search`.
     *
     * @param mixed $args
     *
     * @return mixed
     */
    public static function withoutTopicsInSearch($args)
    {
        if (!\is_array($args) || PortalAccess::canView()) {
            return $args;
        }

        $types = self::otherTypes((array) ($args['post_type'] ?? []));

        // An emptied list would widen back to every searchable type rather
        // than to none, so a search for topics alone finds nothing instead.
        if ($types === []) {
            $args['post__in'] = [0];
        } else {
            $args['post_type'] = $types;
        }

        return $args;
    }

    /**
     * Decline to embed a topic.
     *
     * @param mixed $postId
     *
     * @return mixed
     */
    public static function refuseOembed($postId)
    {
        if (PortalAccess::canView() || !self::isTopic((int) $postId)) {
            return $postId;
        }

        return 0;
    }

    /**
     * Take topic comments out of the site-wide comment feed.
     *
     * A subquery rather than a condition on the posts table, because the
     * single-post comment feed builds its WHERE clause without joining it; a
     * topic's own comment feed is already empty, since restrictMainQuery()
     * finds no topic for it.
     *
     * @param mixed $where
     *
     * @return mixed
     */
    public static function withoutTopicCommentsInFeed($where)
    {
        if (!\is_string($where) || PortalAccess::canView()) {
            return $where;
        }

        global $wpdb;

        return $where . $wpdb->prepare(
            " AND comment_post_ID NOT IN (SELECT ID FROM {$wpdb->posts} WHERE post_type = %s)",
            PostTypes::BIT_CONNECT->value
        );
    }

    /**
     * Keep topics out of the feeds, the site search and the taxonomy archives.
     *
     * Only the front-end main query: the plugin's own queries sit behind
     * PortalAccess already, and narrowing them here would turn a topic URL
     * into a 404 where the portal should show its sign-in prompt.
     *
     * @param mixed $query
     */
    public static function restrictMainQuery($query): void
    {
        if (!$query instanceof WP_Query || is_admin() || !$query->is_main_query() || PortalAccess::canView()) {
            return;
        }

        // Its terms name nothing but topics, so there is nothing left to list.
        if ($query->is_tax(self::taxonomies())) {
            $query->set('post__in', [0]);

            return;
        }

        if (!$query->is_feed() && !$query->is_search()) {
            return;
        }

        $requested = $query->get('post_type');

        if ($requested === 'any' || (($requested === '' || $requested === null) && $query->is_search())) {
            $requested = array_values(get_post_types(['exclude_from_search' => false]));
        }

        if (!\is_array($requested)) {
            if ($requested === PostTypes::BIT_CONNECT->value) {
                $query->set('post__in', [0]);
            }

            return;
        }

        $types = self::otherTypes($requested);

        if ($types === []) {
            $query->set('post__in', [0]);

            return;
        }

        $query->set('post_type', $types);
    }

    private static function isTopic(int $postId): bool
    {
        return $postId > 0 && get_post_type($postId) === PostTypes::BIT_CONNECT->value;
    }

    /**
     * The given post types, less the topic type.
     *
     * @param array<int|string, mixed> $types
     *
     * @return array<int, string>
     */
    private static function otherTypes(array $types): array
    {
        return array_values(
            array_filter(
                array_map('strval', $types),
                static fn (string $type): bool => $type !== PostTypes::BIT_CONNECT->value
            )
        );
    }

    /**
     * Registered with `rest_base` equal to their names — see PostTypeProvider.
     *
     * @return array<int, string>
     */
    private static function restBases(): array
    {
        return array_merge([PostTypes::BIT_CONNECT->value], self::taxonomies());
    }

    /**
     * @return array<int, string>
     */
    private static function taxonomies(): array
    {
        return array_map(static fn (Taxonomies $taxonomy): string => $taxonomy->value, Taxonomies::cases());
    }
}
