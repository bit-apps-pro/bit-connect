<?php

namespace BitApps\BitConnect\Services\Events;

// Prevent direct script access
if (!defined('ABSPATH')) {
    exit;
}

use BitApps\BitConnect\Deps\BitApps\WPKit\Hooks\Hooks;
use BitApps\BitConnect\Enum\PostTypes;
use BitApps\BitConnect\Services\ContentVisibilityService;
use WP_Post;

/**
 * Fires `topic_created` once per topic: the first time it is public.
 *
 * "Created" means "there is a new post people can read", because that is what
 * every listener wants to act on — a topic still waiting for a moderator must
 * not reach a Slack channel or a newsletter. So the event follows the topic's
 * first public moment rather than its insert:
 *
 *   - created public — TopicService::createTopic() calls markCreated() once
 *     its terms are set. The transition WordPress fires during the insert is
 *     ignored, because the topic has no topic type, tag or status yet then.
 *   - written elsewhere (wp-admin, a draft published later) — the
 *     `transition_post_status` listener below.
 *   - held for approval and then approved — whatever holds it calls
 *     announce(). A topic leaving the hidden status is skipped here, because
 *     a topic restored after a report review leaves it the same way, and that
 *     topic is not new.
 *
 * A meta stamp makes it once: a topic made private and public again, or a
 * second caller, does not announce it twice.
 */
final class TopicPublication
{
    public const PUBLISHED_META = '_bit_connect_published_at';

    private static bool $creating = false;

    public static function register(): void
    {
        Hooks::addAction('transition_post_status', [self::class, 'onTransition'], 20, 3);
    }

    /**
     * Brackets TopicService::createTopic()'s insert, so the transition it
     * fires is left to markCreated().
     */
    public static function creating(bool $creating): void
    {
        self::$creating = $creating;
    }

    /**
     * Called by TopicService::createTopic() once the topic and its terms are
     * saved.
     */
    public static function markCreated(WP_Post $post): void
    {
        if ($post->post_status === 'publish') {
            self::announce($post);
        }
    }

    /**
     * @param string  $new
     * @param string  $old
     * @param WP_Post $post
     */
    public static function onTransition($new, $old, $post): void
    {
        if (
            self::$creating
            || $new !== 'publish'
            || $old === 'publish'
            || $old === ContentVisibilityService::HIDDEN_STATUS
            || !$post instanceof WP_Post
            || $post->post_type !== PostTypes::BIT_CONNECT->value
        ) {
            return;
        }

        self::announce($post);
    }

    /**
     * Fires `topic_created` for a topic that is public now, unless it already
     * has been.
     */
    public static function announce(WP_Post $post): void
    {
        if (
            $post->post_status !== 'publish'
            || $post->post_type !== PostTypes::BIT_CONNECT->value
            || get_post_meta($post->ID, self::PUBLISHED_META, true)
        ) {
            return;
        }

        update_post_meta($post->ID, self::PUBLISHED_META, gmdate('c'));

        Events::topicCreated($post);
    }
}
