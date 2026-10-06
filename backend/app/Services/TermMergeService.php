<?php

declare(strict_types=1);

namespace BitApps\BitConnect\Services;

// Prevent direct script access
if (!defined('ABSPATH')) {
    exit;
}

use BitApps\BitConnect\Enum\Taxonomies;
use WP_Error;
use WP_Term;

/**
 * Folding one tag into another.
 *
 * Tags drift: "wordpress", "WordPress" and "wp" end up as three terms for one
 * subject, and deleting two of them strips the topics filed under them. A
 * merge files those topics under the surviving tag first, moves the followers
 * across, and only then deletes the term — so nothing a member chose is lost,
 * and the archive the survivor serves gains what the others held.
 *
 * Tags only. A topic has one stage, one status and one type, so merging terms
 * of those is a different operation (a bulk move with a default to fall back
 * on), and an added taxonomy's own plugin knows its rules; this does not.
 */
final class TermMergeService
{
    public static function isMergeable(string $taxonomy): bool
    {
        return $taxonomy === Taxonomies::TAGS->value;
    }

    /**
     * Files every topic under `$intoId` that was under `$fromId`, moves the
     * followers, and deletes `$fromId`.
     *
     * Ordered so that a failure part-way leaves nothing worse than a topic
     * carrying both tags: the topics are re-filed before anything is removed,
     * and the followers are moved before the term goes, because deleting the
     * term purges whatever still follows it.
     *
     * @return array{moved: int, followers: int}|WP_Error
     */
    public static function merge(string $taxonomy, int $fromId, int $intoId)
    {
        if (!self::isMergeable($taxonomy)) {
            return new WP_Error('bit_connect_term_not_mergeable', __('Only tags can be merged.', 'bit-connect'));
        }

        if ($fromId === $intoId) {
            return new WP_Error('bit_connect_term_merge_self', __('Choose a different tag to merge into.', 'bit-connect'));
        }

        $from = get_term($fromId, $taxonomy);
        $into = get_term($intoId, $taxonomy);

        if (!self::isTermOf($from, $taxonomy) || !self::isTermOf($into, $taxonomy)) {
            return new WP_Error('bit_connect_term_unknown', __('That tag no longer exists.', 'bit-connect'));
        }

        $postIds = get_objects_in_term($fromId, $taxonomy);

        if (is_wp_error($postIds)) {
            return $postIds;
        }

        foreach ($postIds as $postId) {
            // Appended: the topic keeps its other tags, and one already
            // carrying the survivor is left as it is.
            wp_set_post_terms((int) $postId, [$intoId], $taxonomy, true);
        }

        $targetType = FollowService::targetTypeForTaxonomy($taxonomy);
        $followers = $targetType === '' ? 0 : FollowService::retarget($targetType, $fromId, $intoId);

        if (wp_delete_term($fromId, $taxonomy) !== true) {
            return new WP_Error('bit_connect_term_delete_failed', __('The tag could not be removed.', 'bit-connect'));
        }

        return ['moved' => \count($postIds), 'followers' => $followers];
    }

    /**
     * @param mixed $term
     */
    private static function isTermOf($term, string $taxonomy): bool
    {
        return $term instanceof WP_Term && $term->taxonomy === $taxonomy;
    }
}
