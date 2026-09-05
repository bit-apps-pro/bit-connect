<?php

namespace BitApps\BitConnect\Services;

// Prevent direct script access
if (!\defined('ABSPATH')) {
    exit;
}

use BitApps\BitConnect\Enum\Capabilities;
use BitApps\BitConnect\Enum\Taxonomies;
use BitApps\BitConnect\Model\Follow;

/**
 * Who hears about an event.
 *
 * The only place a recipient rule lives. Kept out of the controllers because
 * "who should know about this?" is the question that gets answered differently
 * in six places and then disagrees with itself — a member unfollows a thread and
 * still gets mail from one code path that forgot to ask.
 *
 * Every method here returns raw candidate ids. It does not consult preferences,
 * does not drop the actor and does not deduplicate against other events —
 * NotificationService does all three, once, for every type.
 */
final class NotificationRecipients
{
    /**
     * The most moderators a single event will ever be fanned out to.
     *
     * A guard, not a policy. Any forum with more than this many moderators has
     * something stranger going on than a busy queue, and a report arriving at
     * two hundred inboxes is a worse outcome than a truncated list.
     */
    private const MODERATOR_LIMIT = 50;

    /**
     * Cached for the request: a burst of comments on one page load would
     * otherwise re-run the role scan for each.
     *
     * @var null|array<int, int>
     */
    private static $moderatorCache;

    /**
     * Everyone with a standing interest in a thread: its author, plus everyone
     * following it and still listening.
     *
     * @return array<int, int>
     */
    public static function topicAudience(int $topicId): array
    {
        $ids = FollowService::followerIdsFor(Follow::TARGET_TOPIC, $topicId);

        $author = self::topicAuthor($topicId);

        // Included without needing a follow row, but never over a mute.
        //
        // The first half is why this is here at all: auto-follow covers the
        // author in normal use, but a topic written before this feature existed
        // has no row, and its author is exactly the person who should hear that
        // somebody has finally replied.
        //
        // The second half is what that reasoning missed. "No row" and "muted"
        // are not the same state — the first is silence, the second is a
        // decision — and treating them alike made Mute do nothing at all on the
        // threads people most want to mute: the busy ones they started
        // themselves. followerIdsFor() already filters on `muted`, so the mute
        // was being honoured for every follower except the one person who could
        // not escape it.
        if ($author !== null && !FollowService::hasMuted($author, Follow::TARGET_TOPIC, $topicId)) {
            $ids[] = $author;
        }

        return self::clean($ids);
    }

    /**
     * Who to tell about a brand-new topic.
     *
     * Followers of the products and tags it was filed under, plus anyone
     * following the forum as a whole. Deliberately *not* every member: a
     * broadcast is unusable past a handful of topics a week, and a notification
     * nobody asked for is the fastest way to teach people to ignore the bell.
     *
     * @return array<int, int>
     */
    public static function newTopicAudience(int $topicId): array
    {
        $ids = FollowService::followerIdsFor(Follow::TARGET_FORUM, 0);

        $taxonomyTargets = [
            Taxonomies::DEPARTMENTS->value => Follow::TARGET_DEPARTMENT,
            Taxonomies::TAGS->value        => Follow::TARGET_TAG,
        ];

        foreach ($taxonomyTargets as $taxonomy => $targetType) {
            $termIds = wp_get_object_terms($topicId, $taxonomy, ['fields' => 'ids']);

            if (is_wp_error($termIds)) {
                continue;
            }

            foreach ((array) $termIds as $termId) {
                $ids = array_merge($ids, FollowService::followerIdsFor($targetType, (int) $termId));
            }
        }

        return self::clean($ids);
    }

    /**
     * Everyone who can act on the moderation queue.
     *
     * Both grant paths, because either one alone is wrong: capabilities are set
     * on roles by CapabilityService, and individual accounts can carry a
     * per-user grant that beats their role. The role scan finds the first, the
     * usermeta LIKE finds the second, and user_can() settles the result — it is
     * the same question current_user_can() answers when the moderator actually
     * opens the queue, so the notification and the permission cannot disagree.
     *
     * @return array<int, int>
     */
    public static function moderatorIds(): array
    {
        if (self::$moderatorCache !== null) {
            return self::$moderatorCache;
        }

        $cap = Capabilities::MODERATE->value;
        $candidates = [];

        $roles = wp_roles();
        $rolesWithCap = [];

        foreach ($roles->roles as $slug => $role) {
            if (!empty($role['capabilities'][$cap])) {
                $rolesWithCap[] = $slug;
            }
        }

        if ($rolesWithCap !== []) {
            $candidates = get_users(
                [
                    'fields'   => 'ID',
                    'role__in' => $rolesWithCap,
                    'number'   => self::MODERATOR_LIMIT,
                ]
            );
        }

        // Per-user grants. Narrowed by a LIKE on the serialised capabilities
        // meta rather than walking every account, the way
        // CapabilityService::revokeEditAnyForUsers() does — on a large forum an
        // unfiltered get_users() reads every member to find a handful.
        $perUser = get_users(
            [
                'fields'       => 'ID',
                'meta_key'     => $GLOBALS['wpdb']->get_blog_prefix() . 'capabilities',
                'meta_value'   => $cap,
                'meta_compare' => 'LIKE',
                'number'       => self::MODERATOR_LIMIT,
            ]
        );

        $ids = self::clean(array_merge((array) $candidates, (array) $perUser));

        // The LIKE can over-match — a cap slug that contains this one as a
        // substring would pass — and a role scan cannot see a per-user *denial*.
        // user_can() is the authority either way.
        $confirmed = array_values(
            array_filter($ids, static fn (int $id): bool => user_can($id, $cap))
        );

        self::$moderatorCache = \array_slice($confirmed, 0, self::MODERATOR_LIMIT);

        return self::$moderatorCache;
    }

    /**
     * The author of a topic, or null if it is gone or was never a topic.
     */
    public static function topicAuthor(int $topicId): ?int
    {
        $post = $topicId > 0 ? get_post($topicId) : null;

        if (!$post) {
            return null;
        }

        $author = (int) $post->post_author;

        return $author > 0 ? $author : null;
    }

    /**
     * The author of a comment, or null if it is gone or was left by a guest.
     */
    public static function commentAuthor(int $commentId): ?int
    {
        $comment = $commentId > 0 ? get_comment($commentId) : null;

        if (!$comment) {
            return null;
        }

        $author = (int) $comment->user_id;

        return $author > 0 ? $author : null;
    }

    /**
     * Drops the cached moderator list.
     *
     * Needed after a capability change inside the same request, which the
     * Manager screen does.
     */
    public static function flushModerators(): void
    {
        self::$moderatorCache = null;
    }

    /**
     * Positive, unique, integer ids — nothing else survives.
     *
     * @param array<int, mixed> $ids
     *
     * @return array<int, int>
     */
    private static function clean(array $ids): array
    {
        $ints = array_map('intval', $ids);

        return array_values(array_unique(array_filter($ints, static fn (int $id): bool => $id > 0)));
    }
}
