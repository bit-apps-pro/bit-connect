<?php

namespace BitApps\BitConnect\Services\Events;

// Prevent direct script access
if (!defined('ABSPATH')) {
    exit;
}

use BitApps\BitConnect\Services\ExtensionPoints;
use BitApps\BitConnect\Services\TopicTaxonomies;

/**
 * The forum events another plugin can listen for, and what each one carries.
 *
 * Every event is a plain WordPress action named `bit_connect_<key>`, fired with
 * one argument: a flat array of scalars (see EventPayload). Flat on purpose —
 * automation plugins such as Bit Integrations and Bit Flows map fields by name,
 * and a nested value is one they cannot offer in a field picker.
 *
 * This catalogue is the description of those hooks, not the mechanism. Nothing
 * fires because it is listed here; Events fires, and this says what to expect.
 * It exists so a screen can list the events with their fields and an example,
 * and so `bit_connect_event` is fired for known events only.
 *
 * The hook names are a public contract. A field may be added to an event; a
 * field or an event is never renamed once released.
 *
 * Names use the words the portal uses: the thing a member creates is a
 * "post" (`post_created`, `post_id`) and the grouping it is filed under is a
 * "topic" (`topic_names`, `topic_ids`) — even though a post is still a
 * "topic" inside the code.
 */
final class EventRegistry
{
    public const GROUP_CONTENT = 'content';

    public const GROUP_ENGAGEMENT = 'engagement';

    public const GROUP_MEMBERS = 'members';

    public const GROUP_MODERATION = 'moderation';

    public const GROUPS = [self::GROUP_CONTENT, self::GROUP_ENGAGEMENT, self::GROUP_MEMBERS, self::GROUP_MODERATION];

    /**
     * @var null|array<string, array{hook: string, group: string, label: string, fields: array<string, null|scalar>}>
     */
    private static ?array $all = null;

    /**
     * Every event: this plugin's own, then any another plugin adds.
     *
     * @return array<string, array{hook: string, group: string, label: string, fields: array<string, null|scalar>}>
     */
    public static function all(): array
    {
        if (self::$all !== null) {
            return self::$all;
        }

        $own = self::own();

        return self::$all = $own + ExtensionPoints::integrationEvents(array_keys($own));
    }

    public static function has(string $event): bool
    {
        return isset(self::all()[$event]);
    }

    /**
     * An example payload for one event, built from its field examples.
     *
     * @return array<string, null|scalar>
     */
    public static function sample(string $event): array
    {
        $entry = self::all()[$event] ?? null;

        if ($entry === null) {
            return [];
        }

        return EventPayload::envelope($event) + $entry['fields'];
    }

    /**
     * Drops the memoised catalogue. Only tests need it.
     */
    public static function flush(): void
    {
        self::$all = null;
    }

    /**
     * The fields EventPayload::topic() sends, including `<param>_ids` and
     * `<param>_names` for each taxonomy another plugin files topics under —
     * otherwise a payload carries fields its example does not show.
     *
     * @return array<string, null|scalar>
     */
    public static function topicFields(): array
    {
        $fields = [
            'post_id'           => 42,
            'post_title'        => 'How do I export my data?',
            'post_url'          => home_url('/community/topic/how-do-i-export-my-data/'),
            'post_visibility'   => 'public',
            'post_content'      => '<p>I want to export all my data to a CSV file.</p>',
            'post_content_text' => 'I want to export all my data to a CSV file.',
            'topic_names'       => 'Question',
            'topic_ids'         => '3',
            'tag_names'         => 'export,csv',
            'tag_ids'           => '7,9',
            'post_status'       => 'Open',
            'post_stage'        => 'New',
            'post_created_at'   => '2026-10-20T09:30:00+00:00',
        ];

        foreach (TopicTaxonomies::all() as $param => $entry) {
            $key = str_replace('-', '_', $param);
            $fields[$key . '_ids'] = '3';
            $fields[$key . '_names'] = $entry['singular'];
        }

        return $fields;
    }

    /**
     * @return array<string, null|scalar>
     */
    public static function commentFields(): array
    {
        return [
            'comment_id'           => 128,
            'comment_parent_id'    => 0,
            'comment_content'      => '<p>Open Settings, then select Export.</p>',
            'comment_content_text' => 'Open Settings, then select Export.',
            'comment_url'          => home_url('/community/topic/how-do-i-export-my-data/#comment-128'),
            'comment_status'       => 'approved',
            'comment_created_at'   => '2026-10-20T10:05:00+00:00',
        ];
    }

    /**
     * @return array<string, null|scalar>
     */
    public static function userFields(string $prefix): array
    {
        return [
            $prefix . '_id'          => 5,
            $prefix . '_login'       => 'jane',
            $prefix . '_name'        => 'Jane Doe',
            $prefix . '_email'       => 'jane@example.com',
            $prefix . '_profile_url' => home_url('/community/user/jane/'),
            $prefix . '_roles'       => 'subscriber',
        ];
    }

    /**
     * This plugin's events. The labels say what happened, in the words the
     * portal uses: an item is a "post", and an answer to it is a "comment".
     *
     * @return array<string, array{hook: string, group: string, label: string, fields: array<string, null|scalar>}>
     */
    private static function own(): array
    {
        $topic = self::topicFields();
        $comment = self::commentFields();

        return [
            'post_created' => [
                'hook'   => 'bit_connect_post_created',
                'group'  => self::GROUP_CONTENT,
                'label'  => __('A new post becomes public', 'bit-connect'),
                'fields' => $topic + self::userFields('author'),
            ],
            'post_status_changed' => [
                'hook'   => 'bit_connect_post_status_changed',
                'group'  => self::GROUP_CONTENT,
                'label'  => __('The status or stage of a post changes', 'bit-connect'),
                'fields' => $topic + [
                    'from_status' => 'Open',
                    'from_stage'  => 'New',
                    'changed'     => 'statuses,stages',
                ] + self::userFields('author') + self::userFields('actor'),
            ],
            'comment_created' => [
                'hook'   => 'bit_connect_comment_created',
                'group'  => self::GROUP_CONTENT,
                'label'  => __('A member adds a comment', 'bit-connect'),
                'fields' => $comment + $topic + self::userFields('author'),
            ],
            'post_updated' => [
                'hook'   => 'bit_connect_post_updated',
                'group'  => self::GROUP_CONTENT,
                'label'  => __('A member edits a public post', 'bit-connect'),
                'fields' => $topic + ['changed' => 'title,content'] + self::userFields('author') + self::userFields('actor'),
            ],
            'post_deleted' => [
                'hook'   => 'bit_connect_post_deleted',
                'group'  => self::GROUP_CONTENT,
                'label'  => __('A public post is deleted', 'bit-connect'),
                'fields' => $topic + self::userFields('author') + self::userFields('actor'),
            ],
            'comment_updated' => [
                'hook'   => 'bit_connect_comment_updated',
                'group'  => self::GROUP_CONTENT,
                'label'  => __('A member edits a comment', 'bit-connect'),
                'fields' => $comment + $topic + self::userFields('author'),
            ],
            'comment_deleted' => [
                'hook'   => 'bit_connect_comment_deleted',
                'group'  => self::GROUP_CONTENT,
                'label'  => __('A comment is deleted', 'bit-connect'),
                'fields' => $comment + $topic + ['replies_deleted' => 0] + self::userFields('author') + self::userFields('actor'),
            ],
            'followed' => [
                'hook'   => 'bit_connect_followed',
                'group'  => self::GROUP_ENGAGEMENT,
                'label'  => __('A member follows a post, a tag or the forum', 'bit-connect'),
                'fields' => [
                    'follow_target_type' => 'post',
                    'follow_target_id'   => 42,
                    'follow_target_name' => 'How do I export my data?',
                    'post_visibility'    => 'public',
                ] + self::userFields('member'),
            ],
            'profile_updated' => [
                'hook'   => 'bit_connect_profile_updated',
                'group'  => self::GROUP_MEMBERS,
                'label'  => __('A member changes their profile', 'bit-connect'),
                'fields' => ['changed' => 'display_name,bio'] + self::userFields('member'),
            ],
            'post_voted' => [
                'hook'   => 'bit_connect_post_voted',
                'group'  => self::GROUP_ENGAGEMENT,
                'label'  => __('A member votes for a post', 'bit-connect'),
                'fields' => ['vote_count' => 12] + $topic + self::userFields('author') + self::userFields('member'),
            ],
            'member_registered' => [
                'hook'   => 'bit_connect_member_registered',
                'group'  => self::GROUP_MEMBERS,
                'label'  => __('A person registers on the forum', 'bit-connect'),
                'fields' => self::userFields('member'),
            ],
            'member_logged_in' => [
                'hook'   => 'bit_connect_member_logged_in',
                'group'  => self::GROUP_MEMBERS,
                'label'  => __('A member logs in on the forum', 'bit-connect'),
                'fields' => self::userFields('member'),
            ],
            'report_filed' => [
                'hook'   => 'bit_connect_report_filed',
                'group'  => self::GROUP_MODERATION,
                'label'  => __('A member reports a post or a comment', 'bit-connect'),
                'fields' => self::reportFields() + [
                    'report_reason'  => 'spam',
                    'report_pending' => 2,
                    'report_hidden'  => false,
                ] + self::userFields('reporter'),
            ],
            'report_resolved' => [
                'hook'   => 'bit_connect_report_resolved',
                'group'  => self::GROUP_MODERATION,
                'label'  => __('A moderator closes the reports on an item', 'bit-connect'),
                'fields' => self::reportFields() + [
                    'report_resolution' => 'resolved_kept',
                    'report_note'       => '',
                    'reports_closed'    => 2,
                ] + self::userFields('actor'),
            ],
            'moderation_action' => [
                'hook'   => 'bit_connect_moderation_action',
                'group'  => self::GROUP_MODERATION,
                'label'  => __('A moderator or the forum acts on an item', 'bit-connect'),
                'fields' => [
                    'action'       => 'lock_post',
                    'action_label' => 'Locked a post',
                    'target_type'  => 'post',
                    'target_id'    => 42,
                    'target_title' => 'How do I export my data?',
                    'reason'       => '',
                    'actor_system' => false,
                ] + self::userFields('actor') + self::userFields('target_author'),
            ],
        ];
    }

    /**
     * @return array<string, null|scalar>
     */
    private static function reportFields(): array
    {
        return [
            'report_target_type' => 'post',
            'report_target_id'   => 42,
            'post_id'            => 42,
            'post_title'         => 'How do I export my data?',
            'post_url'           => home_url('/community/topic/how-do-i-export-my-data/'),
            'comment_id'         => 0,
            'comment_content'    => '',
        ];
    }
}
