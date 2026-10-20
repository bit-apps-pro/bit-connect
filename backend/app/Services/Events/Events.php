<?php

namespace BitApps\BitConnect\Services\Events;

// Prevent direct script access
if (!defined('ABSPATH')) {
    exit;
}

use BitApps\BitConnect\Deps\BitApps\WPKit\Hooks\Hooks;
use BitApps\BitConnect\Enum\ActivityActions;
use BitApps\BitConnect\Enum\PostTypes;
use BitApps\BitConnect\Services\ActivityLogService;
use BitApps\BitConnect\Services\ExtensionPoints;
use WP_Comment;
use WP_Post;
use WP_User;

/**
 * Fires the forum's public events.
 *
 * One method per event, each firing its own hook by a literal name — the
 * WordPress.org prefix check reads hook names from source, and cannot read
 * one built from a variable. Each then calls announce(), which fires the one
 * generic `bit_connect_event` a listener can use to hear every event at once.
 *
 * Fired after the write, never instead of it, and nothing here can fail the
 * request that caused it: a listener that throws is its own problem, as with
 * any WordPress action.
 */
final class Events
{
    public static function topicCreated(WP_Post $post): void
    {
        $payload = EventPayload::finalize(
            'topic_created',
            EventPayload::topic($post) + EventPayload::user((int) $post->post_author, 'author')
        );

        Hooks::doAction('bit_connect_topic_created', $payload);
        self::announce('topic_created', $payload);
    }

    /**
     * @param list<string> $changed which of `statuses` and `stages` moved
     */
    public static function topicStatusChanged(WP_Post $post, string $fromStatus, string $fromStage, array $changed): void
    {
        $payload = EventPayload::finalize(
            'topic_status_changed',
            EventPayload::topic($post)
            + [
                'from_status' => $fromStatus,
                'from_stage'  => $fromStage,
                'changed'     => implode(',', $changed),
            ]
            + EventPayload::user((int) $post->post_author, 'author')
            + EventPayload::user(get_current_user_id(), 'actor')
        );

        Hooks::doAction('bit_connect_topic_status_changed', $payload);
        self::announce('topic_status_changed', $payload);
    }

    public static function commentCreated(WP_Comment $comment, WP_Post $post): void
    {
        $payload = EventPayload::finalize(
            'comment_created',
            EventPayload::comment($comment)
            + EventPayload::topic($post)
            + EventPayload::user((int) $comment->user_id, 'author')
        );

        Hooks::doAction('bit_connect_comment_created', $payload);
        self::announce('comment_created', $payload);
    }

    public static function topicVoted(WP_Post $post, int $voterId, int $voteCount): void
    {
        $payload = EventPayload::finalize(
            'topic_voted',
            ['vote_count' => $voteCount]
            + EventPayload::topic($post)
            + EventPayload::user((int) $post->post_author, 'author')
            + EventPayload::user($voterId, 'member')
        );

        Hooks::doAction('bit_connect_topic_voted', $payload);
        self::announce('topic_voted', $payload);
    }

    public static function memberRegistered(int $userId): void
    {
        $payload = EventPayload::finalize('member_registered', EventPayload::user($userId, 'member'));

        Hooks::doAction('bit_connect_member_registered', $payload);
        self::announce('member_registered', $payload);
    }

    public static function memberLoggedIn(WP_User $user): void
    {
        $payload = EventPayload::finalize('member_logged_in', EventPayload::user($user, 'member'));

        Hooks::doAction('bit_connect_member_logged_in', $payload);
        self::announce('member_logged_in', $payload);
    }

    public static function reportFiled(string $targetType, int $targetId, string $reason, int $pending, bool $hidden, int $reporterId): void
    {
        $payload = EventPayload::finalize(
            'report_filed',
            self::target($targetType, $targetId)
            + [
                'report_reason'  => $reason,
                'report_pending' => $pending,
                'report_hidden'  => $hidden,
            ]
            + EventPayload::user($reporterId, 'reporter')
        );

        Hooks::doAction('bit_connect_report_filed', $payload);
        self::announce('report_filed', $payload);
    }

    /**
     * @param array<string, null|scalar> $target the target as it stood before
     *                                           the decision — see target()
     */
    public static function reportResolved(array $target, string $resolution, string $note, int $closed): void
    {
        $payload = EventPayload::finalize(
            'report_resolved',
            $target
            + [
                'report_resolution' => $resolution,
                'report_note'       => $note,
                'reports_closed'    => $closed,
            ]
            + EventPayload::user(get_current_user_id(), 'actor')
        );

        Hooks::doAction('bit_connect_report_resolved', $payload);
        self::announce('report_resolved', $payload);
    }

    /**
     * @param ActivityActions|string $action a case, or a slug another plugin
     *                                       registered through activityActions()
     */
    public static function moderationAction(
        int $actorId,
        ActivityActions|string $action,
        string $targetType,
        int $targetId,
        int $targetAuthor,
        ?string $reason,
        array $context
    ): void {
        $slug = \is_string($action) ? $action : $action->value;
        $label = \is_string($action)
            ? (ExtensionPoints::activityActions()[$action] ?? $action)
            : ActivityActions::translatedLabel($action);

        $payload = EventPayload::finalize(
            'moderation_action',
            [
                'action'       => $slug,
                'action_label' => $label,
                'target_type'  => $targetType,
                'target_id'    => $targetId,
                // The title the log stored (ActivityLogService::titleContext()),
                // which outlives a deleted post.
                'target_title' => (string) ($context['post_title'] ?? $context['topic_title'] ?? ''),
                'reason'       => (string) $reason,
                // The threshold hid it, not a person: recordAsSystem() writes 0.
                'actor_system' => $actorId === 0,
            ]
            + EventPayload::user($actorId, 'actor')
            + EventPayload::user($targetAuthor, 'target_author')
        );

        Hooks::doAction('bit_connect_moderation_action', $payload);
        self::announce('moderation_action', $payload);
    }

    /**
     * Fires `bit_connect_event` for an event the registry knows.
     *
     * Public so another plugin's events reach the same listeners: it fires its
     * own literal hook, then calls this. An event nobody registered is not
     * passed on — a listener of the generic hook may rely on every event it
     * hears being one EventRegistry describes.
     *
     * @param array<string, null|scalar> $payload
     */
    public static function announce(string $event, array $payload): void
    {
        if (!EventRegistry::has($event)) {
            return;
        }

        Hooks::doAction('bit_connect_event', $event, $payload);
    }

    /**
     * What a report is about, read while it still exists: a removed comment
     * can no longer say which topic it was in.
     *
     * @return array<string, null|scalar>
     */
    public static function target(string $targetType, int $targetId): array
    {
        $fields = [
            'report_target_type' => $targetType,
            'report_target_id'   => $targetId,
            'topic_id'           => 0,
            'topic_title'        => '',
            'topic_url'          => '',
            'comment_id'         => 0,
            'comment_content'    => '',
        ];

        $post = null;

        if ($targetType === ActivityLogService::TARGET_COMMENT) {
            $comment = get_comment($targetId);

            if ($comment instanceof WP_Comment) {
                $fields['comment_id'] = (int) $comment->comment_ID;
                $fields['comment_content'] = (string) $comment->comment_content;
                $post = get_post((int) $comment->comment_post_ID);
            }
        } else {
            $post = get_post($targetId);
        }

        if ($post instanceof WP_Post && $post->post_type === PostTypes::BIT_CONNECT->value) {
            $topic = EventPayload::topic($post);
            $fields['topic_id'] = $topic['topic_id'];
            $fields['topic_title'] = $topic['topic_title'];
            $fields['topic_url'] = $topic['topic_url'];
        }

        return $fields;
    }
}
