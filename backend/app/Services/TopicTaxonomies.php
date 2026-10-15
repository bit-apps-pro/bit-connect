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
 * Taxonomies another plugin files topics under, beside this plugin's own.
 *
 * A topic here is organised by type, stage, status and tags. A plugin that
 * registers one more taxonomy on the topic post type describes it through
 * `bit_connect_topic_taxonomies`, and every place a topic's terms travel picks
 * it up from here: the topic form and its validation, the list's filters, the
 * terms a topic is returned with, the portal's term archives, ordering in the
 * admin, and following.
 *
 * Each entry, keyed by the request parameter that carries its terms:
 *
 *   - `taxonomy`  registered taxonomy name. Entries whose taxonomy does not
 *                 exist are dropped, so a plugin that unregisters it leaves no
 *                 parameter behind.
 *   - `singular`, `plural`  what the taxonomy is called, already translated.
 *   - `required`  whether a topic cannot be created without one of its terms.
 *   - `archive`   the key its portal archives are stored under in SEO settings
 *                 and sitemap names, or '' for none.
 *   - `slug`      the URL segment those archives answer to.
 *   - `follow`    the follow target type members follow a term by, or ''.
 *   - `orderable` whether the admin may drag its terms into an order.
 *   - `icons`     whether its terms carry an icon.
 *   - `assignable` optional callable(int $termId, int $userId): bool — whether
 *                 that member may file a topic under that term. Omitted, any
 *                 term of the taxonomy may be chosen. Asked when a topic is
 *                 created or edited; an answer other than `true` refuses.
 *
 * Every field is checked rather than trusted: a parameter or segment this
 * plugin already uses is refused, so an entry can add to the portal but never
 * take over a part of it.
 */
final class TopicTaxonomies
{
    /**
     * Request parameters the topic endpoints already read, and the keys a
     * topic's data and terms already carry.
     */
    private const RESERVED_PARAMS = [
        'topic-types', 'topic_types', 'stages', 'statuses', 'tags', 'attachments', 'post_title',
        'post_content', 'post_excerpt', 'post_status', 'post_name', 'search', 'name', 'sortBy',
        'page', 'per_page', 'visibility', 'my_topics', 'slug', 'id', 'topic_id', 'seo', 'is_locked',
        'stage',
    ];

    /**
     * @return array<string, array{taxonomy: string, singular: string, plural: string, required: bool, archive: string, slug: string, follow: string, orderable: bool, icons: bool, assignable: null|callable}>
     */
    public static function all(): array
    {
        $entries = Hooks::applyFilter('bit_connect_topic_taxonomies', []);

        if (!\is_array($entries)) {
            return [];
        }

        $taxonomies = [];

        foreach ($entries as $param => $entry) {
            $param = \is_string($param) ? $param : '';

            if (
                !preg_match('/^[a-z][a-z0-9_-]{0,31}$/', $param)
                || \in_array($param, self::RESERVED_PARAMS, true)
                || !\is_array($entry)
                || !\is_string($entry['taxonomy'] ?? null)
                || !taxonomy_exists($entry['taxonomy'])
            ) {
                continue;
            }

            $archive = sanitize_key((string) ($entry['archive'] ?? ''));
            $slug = sanitize_title((string) ($entry['slug'] ?? $archive));

            if ($archive !== '' && (PortalTaxonomies::isReservedSegment($archive) || $slug === '' || PortalTaxonomies::isReservedSegment($slug))) {
                $archive = '';
            }

            $singular = trim(sanitize_text_field((string) ($entry['singular'] ?? '')));

            $taxonomies[$param] = [
                'taxonomy'  => $entry['taxonomy'],
                'singular'  => $singular === '' ? $param : $singular,
                'plural'    => trim(sanitize_text_field((string) ($entry['plural'] ?? ''))) ?: $singular,
                'required'  => (bool) ($entry['required'] ?? false),
                'archive'   => $archive,
                'slug'      => $archive === '' ? '' : $slug,
                'follow'    => sanitize_key((string) ($entry['follow'] ?? '')),
                'orderable' => (bool) ($entry['orderable'] ?? false),
                'icons'     => (bool) ($entry['icons'] ?? false),
                // Kept only when it can be called; checked, like every field.
                'assignable' => \is_callable($entry['assignable'] ?? null) ? $entry['assignable'] : null,
            ];
        }

        return $taxonomies;
    }

    /**
     * Every taxonomy topics are filed under: this plugin's own and the added.
     *
     * @return array<int, string>
     */
    public static function names(): array
    {
        return [
            ...array_map(static fn (Taxonomies $taxonomy): string => $taxonomy->value, Taxonomies::cases()),
            ...array_column(self::all(), 'taxonomy'),
        ];
    }

    /**
     * The entry carrying a taxonomy, or null when none does.
     *
     * @return null|array{taxonomy: string, singular: string, plural: string, required: bool, archive: string, slug: string, follow: string, orderable: bool, icons: bool, assignable: null|callable}
     */
    public static function forTaxonomy(string $taxonomy): ?array
    {
        foreach (self::all() as $entry) {
            if ($entry['taxonomy'] === $taxonomy) {
                return $entry;
            }
        }

        return null;
    }

    /**
     * Whether a member may file a topic under this term of an added taxonomy.
     *
     * Yes unless the taxonomy's entry says otherwise through `assignable`; a
     * parameter no entry carries is refused.
     */
    public static function mayAssign(string $param, int $termId, int $userId): bool
    {
        $entry = self::all()[$param] ?? null;

        if ($entry === null) {
            return false;
        }

        return $entry['assignable'] === null || ($entry['assignable'])($termId, $userId) === true;
    }

    /**
     * Writes each added taxonomy's terms found in a topic's data.
     *
     * A parameter that is present but empty clears the topic's terms in that
     * taxonomy — unless the taxonomy requires one; a missing one is left alone.
     *
     * @param array<string, mixed> $data the topic's data, keyed by request parameter
     */
    public static function setTerms(int $postId, array $data): void
    {
        foreach (self::all() as $param => $entry) {
            if (\array_key_exists($param, $data)) {
                // Term ids, set as ids. wp_set_post_terms() reads a value for a
                // non-hierarchical taxonomy as a term *name*, so id 87 became a
                // new term called "87".
                $termIds = array_values(array_filter(array_map('intval', (array) $data[$param]), static fn (int $id): bool => $id > 0));

                if ($termIds === [] && $entry['required']) {
                    continue;
                }

                wp_set_object_terms($postId, $termIds, $entry['taxonomy']);
            }
        }
    }
}
