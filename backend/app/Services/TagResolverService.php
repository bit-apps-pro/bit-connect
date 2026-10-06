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
 * Turns what the topic form sent for `tags` into term ids.
 *
 * The form sends an id for a tag picked from the list and a name for one the
 * member typed. A name is matched against the tags that exist before anything
 * is created, by slug — which is how "WordPress", "wordpress" and "Word Press"
 * all land on the one term — and then by exact name. Only a name that matches
 * nothing becomes a new tag, and only for a member allowed to suggest one,
 * within their daily allowance. The new tag waits for review; see
 * TagApprovalService.
 *
 * This is the one place names become ids, so every way a topic is created or
 * edited gets the same answer, and no caller can create a tag by accident.
 */
final class TagResolverService
{
    /** Longest tag name accepted from a member. */
    public const MAX_NAME_LENGTH = 60;

    /**
     * @param array<int, int|string> $refs       ids and names, as sent
     * @param int                    $userId     who is filing the topic
     * @param bool                   $mayCreate  whether they may suggest a tag that does not exist
     *
     * @return array{ids: array<int, int>, created: array<int, array{id: int, name: string}>}|WP_Error
     *                                                                                               the term ids, deduplicated and in the order sent, and the tags
     *                                                                                               this call created — so the caller can say a suggestion was made
     */
    public static function resolve(array $refs, int $userId, bool $mayCreate)
    {
        $ids = [];
        $created = [];
        $allowance = $mayCreate ? max(0, TagApprovalService::DAILY_LIMIT - TagApprovalService::createdToday($userId)) : 0;

        foreach ($refs as $ref) {
            if (\is_int($ref) || (\is_string($ref) && ctype_digit($ref))) {
                $id = (int) $ref;

                if ($id > 0) {
                    $ids[] = $id;
                }

                continue;
            }

            if (!\is_string($ref)) {
                continue;
            }

            $name = self::normalise($ref);

            if ($name === '') {
                continue;
            }

            $existing = self::find($name);

            if ($existing !== null) {
                $ids[] = (int) $existing->term_id;

                continue;
            }

            if (!$mayCreate) {
                return new WP_Error(
                    'bit_connect_tag_create_forbidden',
                    // translators: %s: the tag the member typed.
                    \sprintf(__('“%s” is not a tag here. Pick one from the list.', 'bit-connect'), $name)
                );
            }

            if (\count($created) >= $allowance) {
                return new WP_Error(
                    'bit_connect_tag_limit',
                    // translators: %d: how many new tags a member may suggest per day.
                    \sprintf(__('You can suggest up to %d new tags a day. Pick the rest from the list.', 'bit-connect'), TagApprovalService::DAILY_LIMIT)
                );
            }

            $term = TagApprovalService::createPending($name, $userId);

            if (is_wp_error($term)) {
                return $term;
            }

            $created[] = ['id' => (int) $term->term_id, 'name' => $term->name];
            $ids[] = (int) $term->term_id;
        }

        return ['ids' => array_values(array_unique($ids)), 'created' => $created];
    }

    /**
     * The name as it will be stored: no leading hash, single spaces, trimmed,
     * and no longer than a tag is allowed to be.
     */
    public static function normalise(string $name): string
    {
        $name = ltrim(trim($name), '#');
        $name = trim((string) preg_replace('/\s+/u', ' ', $name));

        return mb_substr($name, 0, self::MAX_NAME_LENGTH);
    }

    private static function find(string $name): ?WP_Term
    {
        $taxonomy = Taxonomies::TAGS->value;

        $bySlug = get_term_by('slug', sanitize_title($name), $taxonomy);

        if ($bySlug instanceof WP_Term) {
            return $bySlug;
        }

        $byName = get_term_by('name', $name, $taxonomy);

        return $byName instanceof WP_Term ? $byName : null;
    }
}
