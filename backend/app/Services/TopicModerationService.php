<?php

namespace BitApps\BitConnect\Services;

// Prevent direct script access
if (!defined('ABSPATH')) {
    exit;
}

use BitApps\BitConnect\Enum\ActivityActions;
use BitApps\BitConnect\Enum\NotificationTypes;
use BitApps\BitConnect\Enum\PostTypes;
use BitApps\BitConnect\Enum\Taxonomies;
use BitApps\BitConnect\Services\Events\Events;
use InvalidArgumentException;
use WP_Post;
use WP_Query;
use WP_Term;

/**
 * What a moderator does to topics, one at a time or several at once.
 *
 * The single-topic endpoint (TopicController) and the admin's Topics screen
 * both act through here, so a status moved from either place notifies the
 * thread the same way, and a lock or a delete is logged the same way.
 *
 * The list is its own query rather than TopicService::getAllTopics(): that one
 * is the portal's, and may lead with topics another plugin puts first, which a
 * table sorted by a column and paged by offset cannot have. It also carries
 * each topic's words and attachments, which a row of a table has no use for.
 */
final class TopicModerationService
{
    /** Actions the bulk endpoint accepts. */
    public const ACTIONS = ['set_status', 'set_stage', 'lock', 'unlock', 'hide', 'restore', 'delete'];

    public const OUTCOME_DONE = 'done';

    /** Already so — locking a locked topic, hiding a hidden one. */
    public const OUTCOME_SKIPPED = 'skipped';

    public const OUTCOME_FAILED = 'failed';

    /** Columns the list may be sorted by, as the request names them. */
    public const ORDER_BY = ['date', 'modified', 'comment_count', 'title'];

    public const VISIBILITIES = ['public', 'private', 'hidden'];

    private TopicService $topicService;

    public function __construct(?TopicService $topicService = null)
    {
        $this->topicService = $topicService ?? new TopicService();
    }

    /**
     * One page of topics for the moderation table.
     *
     * Every status a moderator may see — published, private and hidden — unless
     * `visibility` narrows it. `perm => readable` still applies, so a private
     * topic its reader may not open is not listed here either.
     *
     * @param array{page?: int, per_page?: int, search?: string, author?: int, status?: int, stage?: int, topic_type?: int, visibility?: string, orderby?: string, order?: string, view?: string, terms?: array<string, int>} $filters
     *
     * @return array{rows: array<int, array<string, mixed>>, total: int}
     */
    public function list(array $filters): array
    {
        $statuses = [
            'public'  => ['publish'],
            'private' => ['private'],
            'hidden'  => [ContentVisibilityService::HIDDEN_STATUS],
        ];

        $visibility = (string) ($filters['visibility'] ?? '');
        $orderBy = (string) ($filters['orderby'] ?? 'date');

        $args = [
            'post_type'           => PostTypes::BIT_CONNECT->value,
            'post_status'         => $statuses[$visibility] ?? ['publish', 'private', ContentVisibilityService::HIDDEN_STATUS],
            'perm'                => 'readable',
            'ignore_sticky_posts' => true,
            'posts_per_page'      => max(1, min(100, (int) ($filters['per_page'] ?? 20))),
            'paged'               => max(1, (int) ($filters['page'] ?? 1)),
            'orderby'             => \in_array($orderBy, self::ORDER_BY, true) ? $orderBy : 'date',
            'order'               => strtoupper((string) ($filters['order'] ?? '')) === 'ASC' ? 'ASC' : 'DESC',
        ];

        if (!empty($filters['author'])) {
            $args['author'] = (int) $filters['author'];
        }

        if (!empty($filters['search'])) {
            $args['s'] = (string) $filters['search'];
        }

        $taxQuery = [];
        $byTerm = [
            Taxonomies::STATUSES->value    => (int) ($filters['status'] ?? 0),
            Taxonomies::STAGES->value      => (int) ($filters['stage'] ?? 0),
            Taxonomies::TOPIC_TYPES->value => (int) ($filters['topic_type'] ?? 0),
        ];

        foreach (TopicTaxonomies::all() as $param => $entry) {
            $byTerm[$entry['taxonomy']] = (int) ($filters['terms'][$param] ?? 0);
        }

        foreach ($byTerm as $taxonomy => $termId) {
            if ($termId > 0) {
                $taxQuery[] = ['taxonomy' => $taxonomy, 'field' => 'term_id', 'terms' => [$termId]];
            }
        }

        if ($taxQuery !== []) {
            if (\count($taxQuery) > 1) {
                $taxQuery['relation'] = 'AND';
            }

            // phpcs:ignore WordPress.DB.SlowDBQuery.slow_db_query_tax_query -- Topics are filtered by taxonomy by design; there is no meta equivalent.
            $args['tax_query'] = $taxQuery;
        }

        if (!empty($filters['view'])) {
            $args = ExtensionPoints::topicListQuery($args, (string) $filters['view']);
        }

        $args = ExtensionPoints::topicQueryArgs($args, get_current_user_id(), 'list');

        $query = new WP_Query($args);
        $posts = array_values(array_filter($query->posts, static fn ($post): bool => $post instanceof WP_Post));

        return [
            'rows'  => array_map([self::class, 'row'], $posts),
            'total' => (int) $query->found_posts,
        ];
    }

    /**
     * A topic as one row of the moderation table: what it is filed under and
     * what state it is in, without its words.
     *
     * @return array<string, mixed>
     */
    public static function row(WP_Post $post): array
    {
        $id = (int) $post->ID;
        $author = get_userdata((int) $post->post_author);

        $terms = [];
        foreach (TopicTaxonomies::all() as $param => $entry) {
            $terms[$param] = self::firstTerm($id, $entry['taxonomy'], false);
        }

        return ExtensionPoints::moderationRowFields([
            'id'             => $id,
            'title'          => wp_specialchars_decode((string) $post->post_title, ENT_QUOTES),
            'permalink'      => PortalLocation::topicUrl($id),
            'post_status'    => (string) $post->post_status,
            'hidden'         => $post->post_status === ContentVisibilityService::HIDDEN_STATUS,
            'is_locked'      => $post->comment_status === 'closed',
            'created_at'     => (string) $post->post_date_gmt,
            'comments_count' => (int) $post->comment_count,
            'author'         => [
                'id'     => (int) $post->post_author,
                'name'   => $author ? (string) $author->display_name : '',
                'avatar' => (string) get_avatar_url((int) $post->post_author, ['size' => 48]),
            ],
            'status'     => self::firstTerm($id, Taxonomies::STATUSES->value, true),
            'stage'      => self::firstTerm($id, Taxonomies::STAGES->value, true),
            'topic_type' => self::firstTerm($id, Taxonomies::TOPIC_TYPES->value, true),
            'terms'      => $terms,
        ], $id);
    }

    /**
     * Each taxonomy another plugin files topics under, with the terms the
     * moderator could filter by — see TopicTaxonomies.
     *
     * @return array<int, array{param: string, label: string, terms: array<int, array{id: int, name: string}>}>
     */
    public static function filterTaxonomies(): array
    {
        $lists = [];

        foreach (TopicTaxonomies::all() as $param => $entry) {
            $terms = get_terms(['taxonomy' => $entry['taxonomy'], 'hide_empty' => false]);
            $terms = ExtensionPoints::portalTerms(\is_array($terms) ? $terms : [], $entry['taxonomy']);

            $lists[] = [
                'param' => $param,
                'label' => $entry['plural'],
                'terms' => array_values(
                    array_map(
                        static fn (WP_Term $term): array => [
                            'id'   => (int) $term->term_id,
                            'name' => wp_specialchars_decode($term->name, ENT_QUOTES),
                        ],
                        array_filter($terms, static fn ($term): bool => $term instanceof WP_Term)
                    )
                ),
            ];
        }

        return $lists;
    }

    /**
     * Does one action to one topic.
     *
     * The caller has already checked the capability the action needs; this
     * checks only that the topic exists and that the moderator may read it, so
     * the table can never act on a topic it would not have listed.
     *
     * @return string one of the OUTCOME_ constants
     */
    public function apply(string $action, int $id, ?int $termId = null): string
    {
        $post = get_post($id);

        if (!$post instanceof WP_Post || $post->post_type !== PostTypes::BIT_CONNECT->value || !TopicService::isReadable($post)) {
            return self::OUTCOME_FAILED;
        }

        $author = (int) $post->post_author;
        $context = ['post_title' => (string) $post->post_title];

        switch ($action) {
            case 'set_status':
            case 'set_stage':
                return $this->setTerm($id, $action === 'set_status' ? 'statuses' : 'stages', (int) $termId);

            case 'lock':
            case 'unlock':
                $lock = $action === 'lock';

                return ($post->comment_status === 'closed') === $lock ? self::OUTCOME_SKIPPED : $this->update($id, $author, ['is_locked' => $lock]);

            case 'hide':
                if ($post->post_status === ContentVisibilityService::HIDDEN_STATUS) {
                    return self::OUTCOME_SKIPPED;
                }

                if (!ContentVisibilityService::hidePost($id)) {
                    return self::OUTCOME_FAILED;
                }

                ActivityLogService::recordIfNotAuthor(ActivityActions::HIDE_POST, ActivityLogService::TARGET_POST, $id, $author, $context);

                return self::OUTCOME_DONE;

            case 'restore':
                if ($post->post_status !== ContentVisibilityService::HIDDEN_STATUS) {
                    return self::OUTCOME_SKIPPED;
                }

                if (!ContentVisibilityService::restorePost($id)) {
                    return self::OUTCOME_FAILED;
                }

                ActivityLogService::recordIfNotAuthor(ActivityActions::RESTORE, ActivityLogService::TARGET_POST, $id, $author, $context);

                return self::OUTCOME_DONE;

            case 'delete':
                $existing = $this->topicService->getTopicById($id);

                return $existing !== null && $this->deleteWithRecord($id, $existing) ? self::OUTCOME_DONE : self::OUTCOME_FAILED;
        }

        return self::OUTCOME_FAILED;
    }

    /**
     * Deletes a topic, then logs it and tells its author.
     *
     * Read before the delete, written after it succeeds. Reading first because
     * once deleteTopic() returns there is no row left to take a title or an
     * author from, and the log row is the only place the topic will have
     * existed. Writing after because a delete that fails must not leave a
     * record saying it happened.
     *
     * @param array<string, mixed> $existing the topic as TopicService returned it, read before the delete
     */
    public function deleteWithRecord(int $id, array $existing): bool
    {
        $deleted = [
            'post_title'   => $existing['post_title'] ?? '',
            'post_content' => ActivityLogService::excerpt($existing['post_content'] ?? ''),
        ];
        $deletedAuthor = (int) ($existing['post_author'] ?? 0);

        if (!$this->topicService->deleteTopic($id)) {
            return false;
        }

        ActivityLogService::recordIfNotAuthor(
            ActivityActions::DELETE_POST,
            ActivityLogService::TARGET_POST,
            $id,
            $deletedAuthor,
            $deleted
        );

        // Same notice a report upheld with removal sends. Addressed explicitly:
        // the topic the default audience would be read from is already gone.
        // The dispatcher drops the actor, so deleting your own tells nobody.
        if ($deletedAuthor > 0) {
            NotificationService::dispatch(
                NotificationTypes::CONTENT_ACTIONED,
                NotificationService::TARGET_TOPIC,
                $id,
                [
                    'topic_title' => (string) $deleted['post_title'],
                    'excerpt'     => wp_strip_all_tags((string) $deleted['post_content']),
                ],
                $id,
                [$deletedAuthor]
            );
        }

        return true;
    }

    /**
     * Records what a moderator did to somebody else's topic.
     *
     * Reads the same $updateData the service acted on, so it cannot claim a
     * change that was dropped. A lock is recorded in whichever direction it
     * was moved, so the feed reads as a history rather than a list of
     * "changed locking".
     *
     * @param array<string, mixed> $updateData
     * @param array<string, mixed> $after
     */
    public static function recordTopicActivity(int $id, int $author, array $updateData, array $after): void
    {
        if (isset($updateData['is_locked'])) {
            ActivityLogService::recordIfNotAuthor(
                $updateData['is_locked'] ? ActivityActions::LOCK_POST : ActivityActions::UNLOCK_POST,
                ActivityLogService::TARGET_POST,
                $id,
                $author,
                ['post_title' => $after['post_title'] ?? '']
            );
        }
    }

    /**
     * Tells a thread when its stage or status moves.
     *
     * The one edit to a topic that the people watching it actually want pushed
     * to them: "Planned → Shipped" is the answer they subscribed for.
     *
     * Only fires when a term actually moved. `isset($updateData['statuses'])`
     * alone is true whenever the form posted the field back unchanged, which on
     * the topic endpoint is every single save — so the comparison is the whole
     * guard.
     *
     * @param array<string, mixed> $updateData
     * @param array<string, mixed> $existingTopic
     * @param array<string, mixed> $after
     */
    public static function notifyStatusChange(int $id, array $updateData, array $existingTopic, array $after): void
    {
        $moved = [];

        foreach (['statuses', 'stages'] as $taxonomy) {
            if (!isset($updateData[$taxonomy])) {
                continue;
            }

            if (self::termId($existingTopic, $taxonomy) !== self::termId($after, $taxonomy)) {
                $moved[] = $taxonomy;
            }
        }

        if ($moved === []) {
            return;
        }

        NotificationService::dispatch(
            NotificationTypes::TOPIC_STATUS_CHANGED,
            NotificationService::TARGET_TOPIC,
            $id,
            [
                'topic_title' => (string) ($after['post_title'] ?? ''),
                'changed'     => $moved,
                // Names, not ids, and stored rather than resolved at read time:
                // a status renamed or deleted next month should not turn an old
                // notification into a blank.
                'status' => self::termName($after, 'statuses'),
                'stage'  => self::termName($after, 'stages'),
                'from'   => [
                    'status' => self::termName($existingTopic, 'statuses'),
                    'stage'  => self::termName($existingTopic, 'stages'),
                ],
                'url' => PortalLocation::topicUrl((int) ($after['ID'] ?? 0)),
            ],
            $id
        );

        $post = get_post($id);

        if ($post instanceof WP_Post) {
            Events::topicStatusChanged(
                $post,
                self::termName($existingTopic, 'statuses'),
                self::termName($existingTopic, 'stages'),
                $moved
            );
        }
    }

    /**
     * The id of a topic's single status or stage term, or 0 when it has none.
     *
     * Both live under `terms` as one nullable formatted term rather than a list
     * — see TopicService::getTopicTerms(), which takes [0] of each taxonomy.
     *
     * @param array<string, mixed> $topic
     */
    public static function termId(array $topic, string $key): int
    {
        $terms = \is_array($topic['terms'] ?? null) ? $topic['terms'] : [];
        $term = \is_array($terms[$key] ?? null) ? $terms[$key] : [];

        return (int) ($term['term_id'] ?? 0);
    }

    /**
     * The name of a topic's single status or stage term, or '' when it has none.
     *
     * @param array<string, mixed> $topic
     */
    public static function termName(array $topic, string $key): string
    {
        $terms = \is_array($topic['terms'] ?? null) ? $topic['terms'] : [];
        $term = \is_array($terms[$key] ?? null) ? $terms[$key] : [];

        return (string) ($term['name'] ?? '');
    }

    /**
     * Files a topic under a status or a stage, and tells its thread.
     *
     * @param string $key `statuses` or `stages`, as TopicService::updateTopic() takes them
     */
    private function setTerm(int $id, string $key, int $termId): string
    {
        $existing = $this->topicService->getTopicById($id);

        if ($existing === null) {
            return self::OUTCOME_FAILED;
        }

        if (self::termId($existing, $key) === $termId) {
            return self::OUTCOME_SKIPPED;
        }

        $updateData = [$key => $termId];

        try {
            $after = $this->topicService->updateTopic($id, $updateData);
        } catch (InvalidArgumentException $e) {
            return self::OUTCOME_FAILED;
        }

        if ($after === null) {
            return self::OUTCOME_FAILED;
        }

        self::notifyStatusChange($id, $updateData, $existing, $after);

        return self::OUTCOME_DONE;
    }

    /**
     * Locks or unlocks through the topic service, and logs it.
     *
     * @param array<string, bool> $updateData
     */
    private function update(int $id, int $author, array $updateData): string
    {
        try {
            $after = $this->topicService->updateTopic($id, $updateData);
        } catch (InvalidArgumentException $e) {
            return self::OUTCOME_FAILED;
        }

        if ($after === null) {
            return self::OUTCOME_FAILED;
        }

        self::recordTopicActivity($id, $author, $updateData, $after);

        return self::OUTCOME_DONE;
    }

    /**
     * A topic's one term in a taxonomy, as the table shows it.
     *
     * @return null|array{id: int, name: string, slug: string, color?: null|string}
     */
    private static function firstTerm(int $postId, string $taxonomy, bool $withColor): ?array
    {
        $terms = get_the_terms($postId, $taxonomy);

        if (!\is_array($terms) || $terms === [] || !$terms[0] instanceof WP_Term) {
            return null;
        }

        $term = $terms[0];
        $data = [
            'id'   => (int) $term->term_id,
            'name' => wp_specialchars_decode($term->name, ENT_QUOTES),
            'slug' => (string) $term->slug,
        ];

        if ($withColor) {
            $color = get_term_meta((int) $term->term_id, 'bit_connect_color', true);
            $data['color'] = \is_string($color) && $color !== '' ? $color : null;
        }

        return $data;
    }
}
