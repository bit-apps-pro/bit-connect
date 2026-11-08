<?php

namespace BitApps\BitConnect\Services\Events;

// Prevent direct script access
if (!defined('ABSPATH')) {
    exit;
}

use BitApps\BitConnect\Deps\BitApps\WPKit\Hooks\Hooks;
use BitApps\BitConnect\Enum\Taxonomies;
use BitApps\BitConnect\Services\ContentVisibilityService;
use BitApps\BitConnect\Services\PortalLocation;
use BitApps\BitConnect\Services\ProfileSlugService;
use BitApps\BitConnect\Services\TopicTaxonomies;
use WP_Comment;
use WP_Post;
use WP_Term;
use WP_User;

/**
 * Builds the one array every forum event carries.
 *
 * Flat, and scalars only: a list becomes a comma-separated string, a date an
 * ISO 8601 string in UTC. Automation plugins map fields by name and offer
 * each as a value to drop into a step, which a nested array cannot be. The
 * field names are the contract EventRegistry describes; a builder here may add
 * a field, never rename one.
 */
final class EventPayload
{
    public const SCHEMA_VERSION = 1;

    /**
     * What every event says about itself.
     *
     * @return array<string, null|scalar>
     */
    public static function envelope(string $event): array
    {
        return [
            'event'          => $event,
            'event_id'       => wp_generate_uuid4(),
            'occurred_at'    => gmdate('c'),
            'schema_version' => self::SCHEMA_VERSION,
            'site_url'       => home_url('/'),
            'site_name'      => (string) get_bloginfo('name'),
        ];
    }

    /**
     * A topic, under `topic_*`, plus `<param>_ids` and `<param>_names` for
     * each taxonomy another plugin files topics under (TopicTaxonomies).
     *
     * @return array<string, null|scalar>
     */
    public static function topic(WP_Post $post): array
    {
        $content = (string) $post->post_content;

        $fields = [
            'topic_id'           => (int) $post->ID,
            'topic_title'        => (string) $post->post_title,
            'topic_url'          => PortalLocation::topicUrl($post),
            'topic_visibility'   => self::visibility((string) $post->post_status),
            'topic_content'      => $content,
            'topic_content_text' => self::text($content),
            'topic_types'        => self::termNames($post, Taxonomies::TOPIC_TYPES->value),
            'topic_type_ids'     => self::termIds($post, Taxonomies::TOPIC_TYPES->value),
            'topic_tags'         => self::termNames($post, Taxonomies::TAGS->value),
            'topic_tag_ids'      => self::termIds($post, Taxonomies::TAGS->value),
            'topic_status'       => self::termNames($post, Taxonomies::STATUSES->value),
            'topic_stage'        => self::termNames($post, Taxonomies::STAGES->value),
            'topic_created_at'   => self::date((string) $post->post_date_gmt),
        ];

        foreach (TopicTaxonomies::all() as $param => $entry) {
            $key = str_replace('-', '_', $param);
            $fields[$key . '_ids'] = self::termIds($post, $entry['taxonomy']);
            $fields[$key . '_names'] = self::termNames($post, $entry['taxonomy']);
        }

        return $fields;
    }

    /**
     * A comment, under `comment_*`.
     *
     * @return array<string, null|scalar>
     */
    public static function comment(WP_Comment $comment): array
    {
        $content = (string) $comment->comment_content;

        return [
            'comment_id'           => (int) $comment->comment_ID,
            'comment_parent_id'    => (int) $comment->comment_parent,
            'comment_content'      => $content,
            'comment_content_text' => self::text($content),
            'comment_url'          => (string) get_comment_link($comment),
            'comment_status'       => self::commentStatus($comment),
            'comment_created_at'   => self::date((string) $comment->comment_date_gmt),
        ];
    }

    /**
     * A person, under `<prefix>_*`. Every key is present for a user who no
     * longer exists, or for no user at all (0), so a mapped field is empty
     * rather than missing.
     *
     * @param int|WP_User $user
     *
     * @return array<string, null|scalar>
     */
    public static function user($user, string $prefix): array
    {
        $user = $user instanceof WP_User ? $user : get_userdata((int) $user);
        $exists = $user instanceof WP_User && $user->ID > 0;
        $slug = $exists ? (string) ProfileSlugService::slugFor($user->ID) : '';

        return [
            $prefix . '_id'          => $exists ? (int) $user->ID : 0,
            $prefix . '_login'       => $exists ? (string) $user->user_login : '',
            $prefix . '_name'        => $exists ? (string) $user->display_name : '',
            $prefix . '_email'       => $exists ? (string) $user->user_email : '',
            $prefix . '_profile_url' => $slug !== '' ? user_trailingslashit(PortalLocation::url('user/' . $slug)) : '',
            $prefix . '_roles'       => $exists ? implode(',', (array) $user->roles) : '',
        ];
    }

    /**
     * The envelope and the parts, as one array, with anything that is not a
     * scalar dropped. A site may remove fields — an email address, say —
     * through `bit_connect_event_payload`; it cannot change the envelope.
     *
     * @param array<string, mixed> $parts
     *
     * @return array<string, null|scalar>
     */
    public static function finalize(string $event, array $parts): array
    {
        $envelope = self::envelope($event);
        $payload = self::scalars($parts);

        $filtered = Hooks::applyFilter('bit_connect_event_payload', $payload, $event);

        if (\is_array($filtered)) {
            $payload = self::scalars($filtered);
        }

        return $envelope + $payload;
    }

    /**
     * @param array<mixed> $values
     *
     * @return array<string, null|scalar>
     */
    private static function scalars(array $values): array
    {
        return array_filter(
            $values,
            static fn ($value, $key): bool => \is_string($key) && ($value === null || \is_scalar($value)),
            ARRAY_FILTER_USE_BOTH
        );
    }

    private static function visibility(string $postStatus): string
    {
        return match ($postStatus) {
            'publish'                               => 'public',
            ContentVisibilityService::HIDDEN_STATUS => 'hidden',
            'private'                               => 'private',
            default                                 => $postStatus,
        };
    }

    private static function commentStatus(WP_Comment $comment): string
    {
        return match ((string) $comment->comment_approved) {
            '1'     => 'approved',
            '0'     => 'pending',
            default => (string) $comment->comment_approved,
        };
    }

    private static function text(string $html): string
    {
        return trim(html_entity_decode(wp_strip_all_tags($html), ENT_QUOTES | ENT_HTML5, 'UTF-8'));
    }

    private static function date(string $gmt): string
    {
        if ($gmt === '' || str_starts_with($gmt, '0000')) {
            return '';
        }

        // Not mysql2date(): it reads the string in the site's timezone, and this
        // one is already UTC.
        $time = strtotime($gmt . ' UTC');

        return $time === false ? '' : gmdate('c', $time);
    }

    private static function termNames(WP_Post $post, string $taxonomy): string
    {
        return implode(',', array_map(static fn ($term): string => (string) $term->name, self::terms($post, $taxonomy)));
    }

    private static function termIds(WP_Post $post, string $taxonomy): string
    {
        return implode(',', array_map(static fn ($term): int => (int) $term->term_id, self::terms($post, $taxonomy)));
    }

    /**
     * @return array<int, WP_Term>
     */
    private static function terms(WP_Post $post, string $taxonomy): array
    {
        if (!taxonomy_exists($taxonomy)) {
            return [];
        }

        $terms = get_the_terms($post, $taxonomy);

        return \is_array($terms) ? $terms : [];
    }
}
