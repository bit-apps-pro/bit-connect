<?php

declare(strict_types=1);

namespace BitApps\BitConnect\Services;

// Prevent direct script access
if (!defined('ABSPATH')) {
    exit;
}

use BitApps\BitConnect\Deps\BitApps\WPKit\Hooks\Hooks;
use BitApps\BitConnect\Enum\Taxonomies;

/**
 * When a topic last moved stage — what lets the roadmap say "Shipped Sep 28".
 *
 * WordPress keeps no history of a post's terms, and neither the publish date
 * nor the modified date answers the question: a topic can sit untouched in
 * Planned for months and be shipped with no edit to it at all. So the moment
 * is recorded as it happens, from `set_object_terms`, which every path that
 * files a topic under a stage goes through — the portal, the admin screens,
 * the REST API and WP-CLI alike.
 *
 * Topics that changed stage before this existed are dated once, on upgrade,
 * by the Bit_Connect_StageDates migration.
 */
final class StageHistoryService
{
    /** Post meta: when the topic entered its current stage, GMT `Y-m-d H:i:s`. */
    public const META_CHANGED_AT = '_bit_connect_stage_changed_at';

    public static function register(): void
    {
        Hooks::addAction('set_object_terms', [self::class, 'onTermsSet'], 10, 6);
    }

    /**
     * Stamp the topic when its stage terms differ from what they were.
     *
     * Saving a topic re-sets its stage to the one it already has, and that is
     * not a move — the old and new term lists are compared, not merely the
     * fact that terms were set.
     *
     * @param int|string        $objectId
     * @param mixed             $terms
     * @param array<int|string> $ttIds    term taxonomy IDs now set
     * @param string            $taxonomy
     * @param bool              $append
     * @param array<int|string> $oldTtIds term taxonomy IDs before
     */
    public static function onTermsSet($objectId, $terms, $ttIds, $taxonomy, $append, $oldTtIds): void
    {
        if ($taxonomy !== Taxonomies::STAGES->value) {
            return;
        }

        if (self::normalise($ttIds) === self::normalise($oldTtIds)) {
            return;
        }

        update_post_meta((int) $objectId, self::META_CHANGED_AT, gmdate('Y-m-d H:i:s'));
    }

    /**
     * When the topic entered its current stage, GMT `Y-m-d H:i:s`, or '' when
     * there is no record. A read only: listing topics never writes.
     */
    public static function changedAt(int $postId): string
    {
        $value = get_post_meta($postId, self::META_CHANGED_AT, true);

        return \is_string($value) ? $value : '';
    }

    /**
     * @param mixed $ids
     *
     * @return int[]
     */
    private static function normalise($ids): array
    {
        $ids = array_map('intval', (array) $ids);
        sort($ids);

        return $ids;
    }
}
