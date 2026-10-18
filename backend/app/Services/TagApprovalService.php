<?php

declare(strict_types=1);

namespace BitApps\BitConnect\Services;

// Prevent direct script access
if (!defined('ABSPATH')) {
    exit;
}

use BitApps\BitConnect\Enum\Taxonomies;
use WP_Error;
use WP_REST_Response;
use WP_Term;

/**
 * Tags members suggest, and what happens to them before an administrator
 * has looked.
 *
 * A member with the capability may file a topic under a tag that does not
 * exist yet. The tag is created at once and goes on the topic — the member
 * should not have to wait to post — but it carries a `pending` flag, and a
 * pending tag is kept out of everywhere the vocabulary is offered: the topic
 * form's picker, the list's filter, the sitemap and the index. It is visible
 * only on the topics that carry it, marked as awaiting review, and on the
 * admin's Tags screen, where it is approved, merged into an existing tag, or
 * deleted. Approval is just the flag coming off.
 *
 * Who added a tag and when is kept on every member-created tag, approved or
 * not, so the admin can see where the vocabulary is coming from and so the
 * per-member daily limit has something to count.
 */
final class TagApprovalService
{
    public const META_STATUS = 'bit_connect_tag_status';

    public const META_CREATOR = 'bit_connect_tag_creator';

    public const META_CREATED_AT = 'bit_connect_tag_created_at';

    public const STATUS_PENDING = 'pending';

    /**
     * How many new tags one member may suggest in a day.
     *
     * Enough for anyone filing a topic in good faith, and few enough that a
     * member who sets out to litter the vocabulary gets nowhere.
     */
    public const DAILY_LIMIT = 3;

    /**
     * Registers the meta so core's terms endpoint, which the admin screen
     * reads, carries it with every tag.
     */
    public static function register(): void
    {
        $fields = [
            self::META_STATUS     => ['type' => 'string', 'sanitize_callback' => 'sanitize_key'],
            self::META_CREATOR    => ['type' => 'integer', 'sanitize_callback' => 'absint'],
            self::META_CREATED_AT => ['type' => 'string', 'sanitize_callback' => 'sanitize_text_field'],
        ];

        foreach ($fields as $key => $args) {
            register_term_meta(
                Taxonomies::TAGS->value,
                $key,
                $args + [
                    'single'       => true,
                    'show_in_rest' => true,
                    // Written by this plugin only: the admin screen reads it and
                    // approves through this plugin's own route.
                    'auth_callback' => '__return_false',
                ]
            );
        }
    }

    public static function isPending(int $termId): bool
    {
        return get_term_meta($termId, self::META_STATUS, true) === self::STATUS_PENDING;
    }

    /**
     * Every tag still awaiting review.
     *
     * @return array<int, int>
     */
    public static function pendingIds(): array
    {
        $ids = get_terms([
            'taxonomy'   => Taxonomies::TAGS->value,
            'hide_empty' => false,
            'fields'     => 'ids',
            'meta_key'   => self::META_STATUS,
            'meta_value' => self::STATUS_PENDING,
        ]);

        return is_wp_error($ids) ? [] : array_map('intval', $ids);
    }

    /**
     * Creates a tag a member suggested, flagged for review.
     *
     * @return WP_Error|WP_Term
     */
    public static function createPending(string $name, int $userId)
    {
        $inserted = wp_insert_term($name, Taxonomies::TAGS->value, ['slug' => sanitize_title($name)]);

        if (is_wp_error($inserted)) {
            return $inserted;
        }

        $termId = (int) $inserted['term_id'];

        update_term_meta($termId, self::META_STATUS, self::STATUS_PENDING);
        update_term_meta($termId, self::META_CREATOR, $userId);
        update_term_meta($termId, self::META_CREATED_AT, current_time('mysql', true));

        $term = get_term($termId, Taxonomies::TAGS->value);

        return $term instanceof WP_Term ? $term : new WP_Error('bit_connect_tag_missing', __('The tag could not be created.', 'bit-connect'));
    }

    /**
     * How many tags a member has suggested in the last day.
     */
    public static function createdToday(int $userId): int
    {
        $ids = get_terms([
            'taxonomy'   => Taxonomies::TAGS->value,
            'hide_empty' => false,
            'fields'     => 'ids',
            'meta_key'   => self::META_CREATOR,
            'meta_value' => (string) $userId,
        ]);

        if (is_wp_error($ids)) {
            return 0;
        }

        $since = strtotime(current_time('mysql', true)) - DAY_IN_SECONDS;
        $count = 0;

        foreach ($ids as $id) {
            $createdAt = strtotime((string) get_term_meta((int) $id, self::META_CREATED_AT, true));

            if ($createdAt !== false && $createdAt >= $since) {
                ++$count;
            }
        }

        return $count;
    }

    /**
     * Takes the flag off: the tag is now part of the vocabulary.
     *
     * @return true|WP_Error
     */
    public static function approve(int $termId)
    {
        $term = get_term($termId, Taxonomies::TAGS->value);

        if (!$term instanceof WP_Term || $term->taxonomy !== Taxonomies::TAGS->value) {
            return new WP_Error('bit_connect_term_unknown', __('That tag no longer exists.', 'bit-connect'));
        }

        delete_term_meta($termId, self::META_STATUS);

        return true;
    }

    /**
     * `rest_prepare_bit-connect-tags`: the suggester's name beside the id, so
     * the admin's table can say who added a tag without a lookup per row.
     *
     * @param mixed $response
     * @param mixed $term
     *
     * @return mixed
     */
    public static function restFields($response, $term)
    {
        if (!$response instanceof WP_REST_Response || !$term instanceof WP_Term) {
            return $response;
        }

        $creator = (int) get_term_meta($term->term_id, self::META_CREATOR, true);
        $user = $creator > 0 ? get_userdata($creator) : false;

        $response->data['created_by'] = $user ? (string) $user->display_name : '';
        $response->data['pending'] = self::isPending($term->term_id);

        return $response;
    }
}
