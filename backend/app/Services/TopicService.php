<?php

namespace BitApps\BitConnect\Services;

// Prevent direct script access
if (!defined('ABSPATH')) {
    exit;
}


use BitApps\BitConnect\Config;
use BitApps\BitConnect\Deps\BitApps\WPDatabase\Connection;
use BitApps\BitConnect\Enum\Capabilities;
use BitApps\BitConnect\Enum\PostTypes;
use BitApps\BitConnect\Enum\Taxonomies;
use BitApps\BitConnect\Model\Follow;
use BitApps\BitConnect\Model\Vote;
use WP_Post;
use WP_Query;
use WP_Term;

/**
 * TopicService handles all topic-related business logic.
 */
class TopicService
{
    /** `sortBy` value, and the WP_Query var it becomes, for most votes first. */
    public const ORDER_VOTES = 'votes';

    private const VOTE_ORDER_VAR = 'bit_connect_vote_order';

    /**
     * Total number of topics matching the most recent getAllTopics() query,
     * ignoring pagination limits. Populated by getAllTopics().
     */
    private int $lastQueryTotal = 0;

    /**
     * `posts_clauses` for a topic list ordered by votes: most first, newest
     * first among equals.
     *
     * Counted from the votes table, one row per vote, as every card's own
     * total is (Vote::getPostVoteCount). Not from the `_bit_connect_vote_count`
     * post meta: that cache is written only when something reads it through
     * VoteService, which the listing never does, so on most topics it is
     * simply absent. A LEFT JOIN keeps topics nobody has voted on, as none.
     *
     * @param array<string, string> $clauses
     * @param WP_Query              $query
     *
     * @return array<string, string>
     */
    public static function voteOrderClauses($clauses, $query)
    {
        if (!$query instanceof WP_Query || !$query->get(self::VOTE_ORDER_VAR)) {
            return $clauses;
        }

        global $wpdb;

        $votes = Connection::prop('prefix') . Config::VAR_PREFIX . 'votes';

        $clauses['join'] .= " LEFT JOIN (SELECT post_id, COUNT(*) AS total FROM {$votes} WHERE post_id IS NOT NULL GROUP BY post_id) AS bc_votes ON (bc_votes.post_id = {$wpdb->posts}.ID)";
        $clauses['orderby'] = "COALESCE(bc_votes.total, 0) DESC, {$wpdb->posts}.post_date DESC, {$wpdb->posts}.ID DESC";

        return $clauses;
    }

    /**
     * Get all topics with optional filtering.
     */
    public function getAllTopics(array $filters = []): array
    {
        $includeComments = false;
        $currentUserId = get_current_user_id();
        $isModerator = AuthService::hasModeratorRole($currentUserId);

        $postStatus = ['publish'];

        if ($isModerator) {
            $postStatus[] = 'private';
        } elseif ($currentUserId > 0) {
            $postStatus[] = 'private';
        }

        // Hidden topics are named only for the people who have to review them.
        // Every other query in the plugin lists its statuses the same way, so
        // leaving this one out is what keeps a reported topic out of the
        // listings, the search, the sitemap and the profile pages at once.
        if (ContentVisibilityService::canViewHidden()) {
            $postStatus[] = ContentVisibilityService::HIDDEN_STATUS;
        }

        if (!empty($filters['visibility']) && $filters['visibility'] === 'private') {
            $postStatus = ['private'];
        }

        $args = [
            'post_type'      => PostTypes::BIT_CONNECT->value,
            'post_status'    => $postStatus,
            'posts_per_page' => $filters['numberposts'] ?? -1,
            'orderby'        => $filters['orderby'] ?? 'date',
            'order'          => $filters['order'] ?? 'DESC',
            'perm'           => 'readable',
        ];

        // Paginate when a page is requested (and a finite page size is set).
        if (!empty($filters['paged']) && (int) ($filters['numberposts'] ?? -1) > 0) {
            $args['paged'] = max(1, (int) $filters['paged']);
        }

        if (!empty($filters['my_topics']) && $currentUserId > 0) {
            $args['author'] = $currentUserId;
        }

        // The topics the reader follows. `[0]` when they follow none, because an
        // empty post__in means "no restriction" to WP_Query, not "nothing".
        // `perm => readable` still applies, so a topic they followed and can no
        // longer open drops out.
        if (!empty($filters['followed']) && $currentUserId > 0) {
            $args['post__in'] = Follow::activeTargetIds($currentUserId, Follow::TARGET_TOPIC) ?: [0];
        }

        // Explicit author filter, used by the public profile pages. Previously
        // getTopicsByAuthor() set this and nothing read it, so it silently
        // returned every topic. `perm => readable` above still applies, so a
        // visitor only ever sees the author's topics they are allowed to read.
        if (!empty($filters['author'])) {
            $args['author'] = (int) $filters['author'];
        }

        // A list of the reader's own topics names their hidden ones too — "My
        // Topics" and their own profile. They can already open each by its URL;
        // without this, a member whose topic is hidden had no way back to it
        // once they left the page. Nobody else's list changes: the author
        // clause is what keeps this to their own.
        if (
            $currentUserId > 0
            && (int) ($args['author'] ?? 0) === $currentUserId
            && !\in_array(ContentVisibilityService::HIDDEN_STATUS, $args['post_status'], true)
            && $args['post_status'] !== ['private']
        ) {
            $args['post_status'][] = ContentVisibilityService::HIDDEN_STATUS;
        }

        // Hydrate an explicit set of IDs (the profile's "voted" list, which is
        // paginated over the votes table rather than over posts). Routing it
        // through here rather than formatting posts directly keeps the status
        // and `perm => readable` rules in one place — an unreadable ID in the
        // list is dropped by WP_Query rather than leaking.
        if (!empty($filters['post__in'])) {
            $args['post__in'] = array_map('intval', (array) $filters['post__in']);
            $args['orderby'] = 'post__in';
            unset($args['order']);
        }

        // Add taxonomy filters if provided
        if (!empty($filters['tax_query'])) {
            // phpcs:ignore WordPress.DB.SlowDBQuery.slow_db_query_tax_query -- Topics are filtered by taxonomy by design; there is no meta equivalent.
            $args['tax_query'] = $filters['tax_query'];
        }

        // Add search filter if provided
        if (!empty($filters['s'])) {
            $args['s'] = $filters['s'];
        }

        if (!empty($filters['name'])) {
            $args['name'] = $filters['name'];
            $includeComments = true;
        }

        // Most votes first. Before the view: a named list a plugin adds sets
        // its own order, and that is the more specific question.
        if (($filters['orderby'] ?? '') === self::ORDER_VOTES) {
            $args['orderby'] = 'date';
            $args[self::VOTE_ORDER_VAR] = true;
        }

        if (!empty($filters['view'])) {
            $args = ExtensionPoints::topicListQuery($args, (string) $filters['view']);
        }

        // Every list, whatever it was asked for: whatever a plugin holds back
        // from this reader one topic at a time (isReadable) it keeps out of
        // the lists here too, search and archives included.
        $args = ExtensionPoints::topicQueryArgs($args, $currentUserId, 'list');

        // Just which topics match, for a question about the set rather than a
        // page of it — the same statuses and readability as the list.
        if (!empty($filters['ids_only'])) {
            $args['fields'] = 'ids';
            $args['no_found_rows'] = true;

            return array_map('intval', (new WP_Query($args))->posts);
        }

        // The list is in its own order. WordPress would prepend every sticky
        // post to a list like this one, whatever its taxonomy filters; this
        // plugin does not order by stickiness, so that is switched off. Any
        // topics another plugin has a list lead with (see
        // ExtensionPoints::leadingTopicIds()) are asked for through the list's
        // own arguments instead, then kept out of its pages.
        $args['ignore_sticky_posts'] = true;
        $perPage = (int) ($args['posts_per_page'] ?? -1);
        $page = max(1, (int) ($args['paged'] ?? 1));
        $leading = $this->leadingTopics($args, $filters);

        if ($perPage > 0) {
            $leading = \array_slice($leading, 0, $perPage);
        }

        if ($leading !== []) {
            $args = self::withoutPosts($args, array_map(static fn (WP_Post $post): int => (int) $post->ID, $leading));

            // The leading topics take the first places of page one, so every
            // later page starts that many places earlier in the rest.
            if ($perPage > 0) {
                unset($args['paged']);
                $args['offset'] = $page === 1 ? 0 : ($page - 1) * $perPage - \count($leading);
                $args['posts_per_page'] = $page === 1 ? max(1, $perPage - \count($leading)) : $perPage;
            }
        }

        $query = new WP_Query($args);
        $this->lastQueryTotal = (int) $query->found_posts + \count($leading);

        $posts = $query->posts;

        if ($leading !== [] && $page === 1) {
            // A page the leading topics fill on their own: the one row asked
            // for above was only to count the rest.
            $posts = $perPage > 0 && \count($leading) >= $perPage ? $leading : [...$leading, ...$posts];
        }

        $topics = [];
        foreach ($posts as $post) {
            // A lookup by slug is singular, and WP_Query skips `tax_query` for
            // singular queries — so whatever a plugin excluded through
            // topicQueryArgs() can still come back here. Asked one by one.
            if (!empty($filters['name']) && !self::isReadable($post)) {
                continue;
            }

            $topicData = $this->prepareTopicData($post, $includeComments);
            $topics[] = $topicData;
        }

        // A slug filter is the portal fetching one topic to render its page, and
        // the status list above cannot answer it for a hidden one: the author is
        // allowed to see theirs, and which author that is only becomes knowable
        // once the topic is found. getTopicBySlug() asks exactly that question,
        // and answers null for everybody else — so the fallback can only ever
        // return a topic the reader was already entitled to.
        if ($topics === [] && !empty($filters['name'])) {
            $bySlug = $this->getTopicBySlug((string) $filters['name']);

            if ($bySlug !== null) {
                $this->lastQueryTotal = 1;

                return [$bySlug];
            }
        }

        return $topics;
    }

    /**
     * Slugs of the topic types the readable topics under `$taxQuery` are filed
     * as — only topics this reader could list, so the answer names no type
     * that exists only behind a topic held back from them.
     *
     * @return list<string>
     */
    public function topicTypesUsed(array $taxQuery): array
    {
        // phpcs:ignore WordPress.DB.SlowDBQuery.slow_db_query_tax_query -- Topics are filtered by taxonomy by design; there is no meta equivalent.
        $ids = $this->getAllTopics(['tax_query' => $taxQuery, 'ids_only' => true]);

        if ($ids === []) {
            return [];
        }

        $slugs = wp_get_object_terms($ids, Taxonomies::TOPIC_TYPES->value, ['fields' => 'slugs']);

        return is_wp_error($slugs) ? [] : array_values(array_unique($slugs));
    }

    /**
     * Total topics matching the most recent getAllTopics() call, ignoring the
     * per-page limit. Use right after getAllTopics() to build pagination meta.
     */
    public function getLastQueryTotal(): int
    {
        return $this->lastQueryTotal;
    }

    /**
     * Get a single topic by slug.
     */
    public function getTopicBySlug(string $slug): ?array
    {
        $post = get_page_by_path($slug, OBJECT, PostTypes::BIT_CONNECT->value);

        if (!$post || $post->post_type !== PostTypes::BIT_CONNECT->value) {
            return null;
        }

        // get_page_by_path() matches on slug and post type alone — it applies no
        // status filter at all. Without this, a topic hidden from every listing,
        // or a private one the listing query had just refused, would still be
        // served in full to anyone holding its URL: this is the fallback
        // getAllTopics() reaches for when its own query answers nothing.
        //
        // The author is not a stranger to their own topic: they keep the URL,
        // marked as hidden, while it stays out of every listing for everyone.
        if (!self::isReadable($post)) {
            return null;
        }

        return $this->prepareTopicData($post, true);
    }

    /**
     * Get a single topic by ID, whatever its status.
     *
     * For the write paths, which run their own permission checks. Anything
     * that shows a topic to the current user goes through getReadableTopicById().
     */
    public function getTopicById(int $id): ?array
    {
        $post = get_post($id);

        if (!$post || $post->post_type !== PostTypes::BIT_CONNECT->value) {
            return null;
        }

        return $this->prepareTopicData($post, true);
    }

    /**
     * Get a single topic by ID, or null when the current user may not read it.
     */
    public function getReadableTopicById(int $id): ?array
    {
        $post = get_post($id);

        if (!$post || $post->post_type !== PostTypes::BIT_CONNECT->value || !self::isReadable($post)) {
            return null;
        }

        return $this->prepareTopicData($post, true);
    }

    /**
     * Whether the current user may read this topic.
     *
     * The single-topic twin of the listing query's status list and
     * `perm => readable`: a lookup by ID or slug bypasses both, so it has to
     * ask the same question itself.
     *
     * - Published: anyone.
     * - Hidden by moderation: moderators, and the author, who keeps the URL
     *   marked as hidden while it stays out of every listing.
     * - Private: the author, and whoever may read others' private posts —
     *   exactly who `perm => readable` admits.
     * - Anything else (draft, pending, trash): nobody. The portal writes none
     *   of them, so a topic in one reached it some other way.
     */
    public static function isReadable(WP_Post $post): bool
    {
        $readable = match ($post->post_status) {
            'publish'                               => true,
            ContentVisibilityService::HIDDEN_STATUS => ContentVisibilityService::isPostViewableWhileHidden((int) $post->post_author),
            'private'                               => ContentVisibilityService::isOwnContent((int) $post->post_author)
                || self::mayReadPrivate($post, static fn (string $cap) => current_user_can($cap)),
            default => false,
        };

        // A plugin may hold back a topic these rules allow, never the reverse.
        return $readable && ExtensionPoints::topicReadable($post, get_current_user_id());
    }

    /**
     * Whether a given member — not necessarily the one asking — may read this
     * topic. The same rules as isReadable(), answered for someone else: the
     * notification layer asks it of every recipient before writing them a row
     * that names the topic.
     *
     * @param int $userId the member, 0 for a visitor
     */
    public static function isReadableBy(WP_Post $post, int $userId): bool
    {
        if ($userId === get_current_user_id()) {
            return self::isReadable($post);
        }

        $isAuthor = $userId > 0 && $userId === (int) $post->post_author;

        $readable = match ($post->post_status) {
            'publish'                               => true,
            ContentVisibilityService::HIDDEN_STATUS => $isAuthor
                || ($userId > 0 && user_can($userId, Capabilities::MODERATE->value)),
            'private' => $isAuthor
                || ($userId > 0 && self::mayReadPrivate($post, static fn (string $cap) => user_can($userId, $cap))),
            default => false,
        };

        return $readable && ExtensionPoints::topicReadable($post, $userId);
    }

    /**
     * Create a new topic.
     */
    public function createTopic(array $data, ?int $userId = null): ?array
    {
        $userId = $userId ?: get_current_user_id();

        // Here rather than in a request, so every route that creates a topic
        // meets it — including ones another plugin registers.
        PostingLimits::assertWithin(
            'topic',
            (string) ($data['post_content'] ?? ''),
            \is_array($data['attachments'] ?? null) ? $data['attachments'] : []
        );

        $postData = [
            'post_type'    => PostTypes::BIT_CONNECT->value,
            'post_status'  => $data['post_status'] ?? 'publish',
            'post_title'   => $data['post_title'] ?? '',
            'post_content' => $data['post_content'] ?? '',
            'post_excerpt' => $data['post_excerpt'] ?? '',
            'post_author'  => $userId,
            'post_name'    => self::resolveSlug(
                $data['post_name'] ?? '',
                sanitize_title($data['post_title'] ?? '')
            ),
        ];

        $postId = wp_insert_post($postData);

        // 0 is how wp_insert_post() reports a failed database write.
        if (is_wp_error($postId) || !$postId) {
            return null;
        }

        // Set taxonomy terms if provided
        if (isset($data['topic_types'])) {
            $res = wp_set_post_terms($postId, $data['topic_types'], Taxonomies::TOPIC_TYPES->value); // phpcs:ignore VariableAnalysis.CodeAnalysis.VariableAnalysis.UnusedVariable
        }

        TopicTaxonomies::setTerms($postId, $data);

        if (isset($data['stages'])) {
            wp_set_post_terms($postId, $data['stages'], Taxonomies::STAGES->value);
        }

        if (isset($data['statuses'])) {
            wp_set_post_terms($postId, $data['statuses'], Taxonomies::STATUSES->value);
        }

        if (isset($data['tags']) && \is_array($data['tags'])) {
            // Ints: a numeric string would be read as a tag name and created.
            wp_set_post_terms($postId, array_map('intval', $data['tags']), Taxonomies::TAGS->value);
        }

        // Link attachments to the topic via post_parent: the files attached
        // below it, and the pictures and videos placed in its text.
        $attached = !empty($data['attachments']) && \is_array($data['attachments']) ? array_map('intval', $data['attachments']) : [];
        $created = get_post($postId);
        $authorId = $created instanceof WP_Post ? (int) $created->post_author : 0;
        $linked = array_merge($attached, $this->inlineUploads((string) ($data['post_content'] ?? ''), $authorId, $postId));

        foreach (array_unique($linked) as $attachmentId) {
            wp_update_post(
                [
                    'ID'          => (int) $attachmentId,
                    'post_parent' => $postId,
                ]
            );
        }

        UploadClaims::claim($linked);

        $post = get_post($postId);

        return $this->prepareTopicData($post, false);
    }

    /**
     * Update an existing topic.
     */
    public function updateTopic(int $id, array $data): ?array
    {
        $existingPost = get_post($id);

        if (!$existingPost || $existingPost->post_type !== PostTypes::BIT_CONNECT->value) {
            return null;
        }

        // Only what this edit sends: a status change carries no content and
        // must not be refused over a topic written under looser limits.
        PostingLimits::assertWithin(
            'topic',
            isset($data['post_content']) ? (string) $data['post_content'] : null,
            isset($data['attachments']) ? (array) $data['attachments'] : null
        );

        $status = $data['post_status'] ?? $existingPost->post_status;

        // A hidden topic comes back through ContentVisibilityService::restorePost()
        // and nothing else. Its author's edit form sends a status with every
        // save, and written here that would put the topic back in public view
        // without the moderator who hid it; it becomes the status the topic
        // returns to instead.
        if ($existingPost->post_status === ContentVisibilityService::HIDDEN_STATUS) {
            if (isset($data['post_status']) && $data['post_status'] !== ContentVisibilityService::HIDDEN_STATUS) {
                update_post_meta($id, ContentVisibilityService::PREV_STATUS_META, $data['post_status']);
            }

            $status = ContentVisibilityService::HIDDEN_STATUS;
        }

        $postData = [
            'ID'           => $id,
            'post_title'   => $data['post_title'] ?? $existingPost->post_title,
            'post_content' => $data['post_content'] ?? $existingPost->post_content,
            'post_excerpt' => $data['post_excerpt'] ?? $existingPost->post_excerpt,
            'post_status'  => $status,
            // The permalink belongs to the topic once it exists: only an explicit
            // slug replaces it. Renaming the title used to silently re-mint this
            // and break every link already pointing at the topic.
            'post_name' => self::resolveSlug(
                $data['post_name'] ?? '',
                $existingPost->post_name !== ''
                    ? $existingPost->post_name
                    : sanitize_title($data['post_title'] ?? $existingPost->post_title)
            ),
        ];

        // Read before the write, while $existingPost still holds the old words.
        $contentChanged = EditAttributionService::postContentChanged($existingPost, $data);

        $result = wp_update_post($postData);

        if (is_wp_error($result) || !$result) {
            return null;
        }

        // Only a change to the words counts as an edit. An update carrying just
        // is_locked still calls wp_update_post() below and bumps post_modified,
        // which is why that column cannot answer this and the meta has to be
        // written deliberately.
        if ($contentChanged) {
            EditAttributionService::recordPost($id, get_current_user_id());
        }

        // Lock/unlock: comment_status open/closed
        if (isset($data['is_locked'])) {
            wp_update_post(
                [
                    'ID'             => $id,
                    'comment_status' => $data['is_locked'] ? 'closed' : 'open',
                ]
            );
        }

        // Update taxonomy terms if provided
        if (isset($data['topic_types'])) {
            wp_set_post_terms($id, $data['topic_types'], Taxonomies::TOPIC_TYPES->value);
        }

        TopicTaxonomies::setTerms($id, $data);

        if (isset($data['stages'])) {
            wp_set_post_terms($id, $data['stages'], Taxonomies::STAGES->value);
        }

        if (isset($data['statuses'])) {
            wp_set_post_terms($id, $data['statuses'], Taxonomies::STATUSES->value);
        }

        if (isset($data['tags']) && \is_array($data['tags'])) {
            wp_set_post_terms($id, array_map('intval', $data['tags']), Taxonomies::TAGS->value);
        }

        // Update attachments: unlink old, link new. The pictures and videos in
        // the text count as the topic's too — read from the text this edit
        // sends, or the text it keeps when it sends none.
        if (isset($data['attachments']) || isset($data['post_content'])) {
            $content = (string) ($data['post_content'] ?? $existingPost->post_content);
            $inline = $this->inlineUploads($content, (int) $existingPost->post_author, $id);

            if (isset($data['attachments'])) {
                $attached = \is_array($data['attachments']) ? array_map('intval', $data['attachments']) : [];
            } else {
                // Only the text changed: the files below it stay as they were.
                $attached = array_map(
                    'intval',
                    array_diff(array_keys(get_attached_media('', $id)), $this->inlineUploads((string) $existingPost->post_content, (int) $existingPost->post_author, $id))
                );
            }

            $newAttachmentIds = array_values(array_unique(array_merge($attached, $inline)));

            // Unlink existing attachments that are not in the new list, and
            // hand the portal's own uploads among them to the daily cleanup.
            $removed = [];
            foreach (get_attached_media('', $id) as $existing) {
                if (!\in_array($existing->ID, $newAttachmentIds, true)) {
                    wp_update_post(
                        [
                            'ID'          => $existing->ID,
                            'post_parent' => 0,
                        ]
                    );
                    $removed[] = $existing->ID;
                }
            }
            UploadClaims::release($removed);

            // Link new attachments to the topic
            foreach ($newAttachmentIds as $attachmentId) {
                wp_update_post(
                    [
                        'ID'          => $attachmentId,
                        'post_parent' => $id,
                    ]
                );
            }
            UploadClaims::claim($newAttachmentIds);
        }

        $post = get_post($result);

        return $this->prepareTopicData($post, false);
    }

    /**
     * Delete a topic.
     */
    public function deleteTopic(int $id): bool
    {
        $post = get_post($id);

        if (!$post || $post->post_type !== PostTypes::BIT_CONNECT->value) {
            return false;
        }

        // The topic's own votes. Its replies are deleted by wp_delete_post()
        // below, which fires `deleted_comment` for each one — anything holding
        // data against a reply cleans up on that hook rather than here.
        (new VoteService())->deletePostVotes($id);

        // WordPress does not delete a post's media with it: it moves them to
        // the post's parent, which for a topic is nothing. The members' own
        // uploads go to the daily cleanup instead of staying behind forever.
        $media = array_keys(get_attached_media('', $id));

        $result = wp_delete_post($id, true);

        if ($result instanceof WP_Post) {
            UploadClaims::release($media);
        }

        return $result instanceof WP_Post;
    }

    /**
     * Search topics.
     */
    public function searchTopics(string $searchTerm, array $filters = []): array
    {
        $filters['s'] = $searchTerm;

        return $this->getAllTopics($filters);
    }

    /**
     * Get topics by author.
     */
    public function getTopicsByAuthor(int $authorId, array $filters = []): array
    {
        $filters['author'] = $authorId;

        return $this->getAllTopics($filters);
    }

    /**
     * Get topics by taxonomy terms.
     */
    public function getTopicsByTerms(string $taxonomy, array $termIds, array $filters = []): array
    {
        // phpcs:ignore WordPress.DB.SlowDBQuery.slow_db_query_tax_query -- Topics are filtered by taxonomy by design; there is no meta equivalent.
        $filters['tax_query'] = [
            [
                'taxonomy' => $taxonomy,
                'field'    => 'term_id',
                'terms'    => $termIds,
            ],
        ];

        return $this->getAllTopics($filters);
    }

    /**
     * Get topic statistics.
     */
    public function getTopicStats(): array
    {
        $totalTopics = wp_count_posts(PostTypes::BIT_CONNECT->value);

        $taxonomyCounts = [
            'topic_types' => wp_count_terms([Taxonomies::TOPIC_TYPES->value]),
            'stages'      => wp_count_terms([Taxonomies::STAGES->value]),
            'statuses'    => wp_count_terms([Taxonomies::STATUSES->value]),
            'tags'        => wp_count_terms([Taxonomies::TAGS->value]),
        ];

        foreach (TopicTaxonomies::all() as $param => $entry) {
            $taxonomyCounts[$param] = wp_count_terms([$entry['taxonomy']]);
        }

        return [
            'total'         => (int) $totalTopics->publish,
            'status_counts' => [
                'publish' => (int) $totalTopics->publish,
                'draft'   => (int) $totalTopics->draft,
                'pending' => (int) $totalTopics->pending,
            ],
            'taxonomy_counts' => $taxonomyCounts,
        ];
    }

    public static function getPostVoteStatus(int $postId): ?array
    {
        $hasVoted = false;
        if (is_user_logged_in()) {
            $currentUserId = get_current_user_id();
            $userVote = Vote::hasUserVoted($currentUserId, $postId);
            $hasVoted = !empty($userVote);
        }

        return [
            'total'    => Vote::getPostVoteCount($postId),
            'hasVoted' => $hasVoted,
        ];
    }

    /**
     * Resolve comment attachment IDs from meta into full objects.
     *
     * @return array<int, array{id: int, filename: string, filesize: int, type: string, url: string}>
     */
    public static function formatCommentAttachments(int $commentId): array
    {
        $attachmentIds = get_comment_meta($commentId, '_bit_connect_comment_attachments', true);
        $formatted = [];

        if (!empty($attachmentIds) && \is_array($attachmentIds)) {
            foreach ($attachmentIds as $attachmentId) {
                $attachmentId = (int) $attachmentId;
                $attachment = get_post($attachmentId);
                if (!$attachment || $attachment->post_type !== 'attachment') {
                    continue;
                }

                $filePath = get_attached_file($attachmentId);
                $formatted[] = [
                    'id'       => $attachmentId,
                    'filename' => basename($filePath ?: $attachment->guid),
                    'filesize' => $filePath && file_exists($filePath) ? (int) filesize($filePath) : 0,
                    'type'     => $attachment->post_mime_type,
                    'url'      => wp_get_attachment_url($attachmentId),
                ];
            }
        }

        return $formatted;
    }

    /**
     * What would happen to a slug if it were saved right now.
     *
     * Answers the availability check the topic form runs while the author is
     * typing. It has to agree with the save path exactly — a preview promising
     * a slug the save then changes is worse than no preview — so it asks the
     * same function `wp_insert_post()` asks rather than reimplementing the
     * rules. `wp_unique_post_slug()` returning the slug unchanged *is* the
     * definition of "available".
     *
     * `$topicId` excludes a topic from clashing with itself, which is what lets
     * an author re-save an unchanged slug on the edit form.
     *
     * The status is fixed at 'publish' rather than taken from the caller:
     * `wp_unique_post_slug()` short-circuits for drafts and returns the slug
     * untouched, which would report every slug as free, and the two statuses a
     * topic can actually hold — publish and private — go down the same branch.
     *
     * @return array{requested: string, slug: string, available: bool}
     */
    public static function previewSlug(string $requested, int $topicId = 0): array
    {
        $sanitized = sanitize_title($requested);

        // Nothing sluggable in it. The save falls back to the title, so there
        // is no slug yet to report a verdict on.
        if ($sanitized === '') {
            return ['requested' => '', 'slug' => '', 'available' => true];
        }

        $resolved = wp_unique_post_slug(
            $sanitized,
            $topicId,
            'publish',
            PostTypes::BIT_CONNECT->value,
            0
        );

        return [
            'requested' => $sanitized,
            'slug'      => $resolved,
            'available' => $resolved === $sanitized,
        ];
    }

    /**
     * " AND {column} NOT IN (…)" over the topics a plugin keeps from this
     * reader, for a query written as SQL; '' when there are none.
     *
     * The ids are integers by the time they reach here (see
     * ExtensionPoints::heldBackTopicIds()), so the list is safe to inline.
     *
     * @param string $column the topic id column, e.g. `p.ID` — the caller's own literal
     * @param int    $userId the reader, 0 for a visitor
     */
    public static function heldBackSql(string $column, int $userId): string
    {
        $ids = ExtensionPoints::heldBackTopicIds($userId);

        return $ids === [] ? '' : " AND {$column} NOT IN (" . implode(',', $ids) . ')';
    }

    /**
     * The topics a list leads with: those another plugin names (see
     * ExtensionPoints::leadingTopicIds()) among what the list itself would
     * return, in its own order. None for a search, a single topic, one
     * author's topics or an explicit set of ids — lists whose order is the
     * point of asking for them.
     *
     * @param array<string, mixed> $args    the list's query, as it stands
     * @param array<string, mixed> $filters
     *
     * @return array<int, WP_Post>
     */
    private function leadingTopics(array $args, array $filters): array
    {
        if (!empty($filters['s']) || !empty($filters['name']) || !empty($args['author']) || ($args['orderby'] ?? '') === 'post__in') {
            return [];
        }

        $ids = ExtensionPoints::leadingTopicIds();

        if (isset($args['post__in'])) {
            $ids = array_values(array_intersect($ids, array_map('intval', (array) $args['post__in'])));
        }

        if ($ids === []) {
            return [];
        }

        unset($args['paged'], $args['offset']);
        $args['post__in'] = $ids;
        $args['posts_per_page'] = -1;
        $args['no_found_rows'] = true;

        return array_values(array_filter((new WP_Query($args))->posts, static fn ($post): bool => $post instanceof WP_Post));
    }

    /**
     * The query with these posts left out. Through `post__in` when the query
     * has one — WP_Query reads `post__not_in` only when it does not.
     *
     * @param array<string, mixed> $args
     * @param array<int, int>      $ids
     *
     * @return array<string, mixed>
     */
    private static function withoutPosts(array $args, array $ids): array
    {
        if (isset($args['post__in'])) {
            // `[0]`, not empty: an empty post__in means "no restriction".
            $args['post__in'] = array_values(array_diff(array_map('intval', (array) $args['post__in']), $ids)) ?: [0];

            return $args;
        }

        $args['post__not_in'] = array_values(array_unique([...array_map('intval', (array) ($args['post__not_in'] ?? [])), ...$ids]));

        return $args;
    }

    /**
     * Whether the capability check given may read other people's private
     * posts of this type — exactly who `perm => readable` admits.
     *
     * @param callable(string): bool $can
     */
    private static function mayReadPrivate(WP_Post $post, callable $can): bool
    {
        $postType = get_post_type_object($post->post_type);

        return $postType && $can($postType->cap->read_private_posts);
    }

    /**
     * The topic author's own uploads shown in the text — never another
     * member's upload a topic happens to link to, and never one attached to
     * some other post.
     *
     * @return int[]
     */
    private function inlineUploads(string $content, int $authorId, int $topicId): array
    {
        return array_values(array_filter(
            UploadClaims::idsInContent($content),
            static function (int $attachmentId) use ($authorId, $topicId): bool {
                $attachment = get_post($attachmentId);

                return $attachment instanceof WP_Post
                    && $attachment->post_type === 'attachment'
                    && (int) $attachment->post_author === $authorId
                    && \in_array((int) $attachment->post_parent, [0, $topicId], true);
            }
        ));
    }

    /**
     * Pick the slug to store, falling back when the requested one is unusable.
     *
     * `sanitize_title()` yields '' for input that is nothing but separators or
     * punctuation, and an empty `post_name` would make WordPress mint one from
     * the title anyway — but only on insert, not on update. Deciding it here
     * keeps both paths identical and keeps the fallback explicit.
     *
     * Uniqueness is left to core: `wp_insert_post()` runs the result through
     * `wp_unique_post_slug()` and `_truncate_post_slug()`, so a clash gets the
     * usual `-2` suffix rather than a hard failure.
     */
    private static function resolveSlug(string $requested, string $fallback): string
    {
        $slug = sanitize_title($requested);

        return $slug !== '' ? $slug : $fallback;
    }

    /**
     * Prepare topic data for API response.
     */
    private function prepareTopicData(WP_Post $post, bool $includeComments = false): array
    {
        $data = [
            'ID'                => $post->ID,
            'post_title'        => $post->post_title,
            'post_content'      => $post->post_content,
            'post_excerpt'      => $post->post_excerpt,
            'post_status'       => $post->post_status,
            'post_date'         => $post->post_date,
            'post_date_gmt'     => $post->post_date_gmt,
            'post_modified'     => $post->post_modified,
            'post_modified_gmt' => $post->post_modified_gmt,
            'post_author'       => $post->post_author,
            'post_type'         => $post->post_type,
            'guid'              => $post->guid,
            'comment_status'    => $post->comment_status,
            'is_locked'         => ($post->comment_status === 'closed'),
            'ping_status'       => $post->ping_status,
            'post_name'         => $post->post_name,
            'post_parent'       => $post->post_parent,
            'menu_order'        => $post->menu_order,
            'post_mime_type'    => $post->post_mime_type,
            'permalink'         => get_permalink($post),
            'author_name'       => get_the_author_meta('display_name', \intval($post->post_author)),
            'author_avatar'     => get_avatar_url($post->post_author),
            // Carried on every topic so a byline can link straight to the
            // author's profile; without it the client would need a lookup per
            // author just to build a URL.
            'author_slug' => ProfileSlugService::slugFor((int) $post->post_author),
            // The author's standing, or null for an ordinary member. Carried
            // here so a topic byline can badge staff without a lookup per topic.
            'author_badge' => UserBadgeService::for((int) $post->post_author),
            // Null until someone edits the words. Not derived from post_modified,
            // which locking bumps.
            'edited' => EditAttributionService::forPost((int) $post->ID),
            // True only for the two audiences that get a hidden topic served at
            // all — its author and a moderator — so the page can say why it is
            // showing them something the public cannot see.
            'hidden'         => $post->post_status === ContentVisibilityService::HIDDEN_STATUS,
            'comments_count' => get_comments_number($post->ID),
            'vote'           => self::getPostVoteStatus($post->ID),
            // When it entered its stage, GMT; '' if that predates the record.
            'stage_changed_at' => StageHistoryService::changedAt((int) $post->ID),
            'terms'            => $this->getTopicTerms($post->ID),
            'attachments'      => $this->formatAttachments($post->ID, (string) $post->post_content),
        ];

        if ($includeComments) {
            $data['comments'] = $this->getTopicComments($post->ID);

            // Only on the single-topic view, and that is the whole point.
            // stateFor() is a database read, and this method also builds every
            // card in the listing — attaching it unconditionally would add one
            // query per card to answer a question no card asks. `$includeComments`
            // is already the flag meaning "this is the full topic page", which
            // is the only place a Follow button is drawn.
            //
            // Carried on the topic rather than fetched separately for the same
            // reason `vote` is: the button has to be right on first paint, and a
            // second round trip to decide what one button says would show the
            // wrong word first. Guests cost nothing — stateFor() answers for
            // user 0 without touching the database.
            $data['following'] = FollowService::stateFor(
                get_current_user_id(),
                Follow::TARGET_TOPIC,
                (int) $post->ID
            );
        }

        return ExtensionPoints::topicFields($data, (int) $post->ID);
    }

    /**
     * Format attached media for API response.
     *
     * @return array<int, array{id: int, filename: string, filesize: int, type: string, url: string}>
     */
    private function formatAttachments(int $postId, string $content): array
    {
        $attachments = get_attached_media('', $postId);
        $formatted = [];

        // The pictures and videos placed in the text are attached to the topic
        // too, so they are claimed and outlive the upload cleanup, but the
        // reader already sees them there. Listing them again under the post
        // would show every one twice. Compared decoded, as a filename with an
        // emoji or a space may be stored either way.
        $inText = array_map('rawurldecode', UploadClaims::sourcesInContent($content));

        foreach ($attachments as $attachment) {
            $url = wp_get_attachment_url($attachment->ID);
            if ($url && \in_array(rawurldecode($url), $inText, true)) {
                continue;
            }

            $filePath = get_attached_file($attachment->ID);
            $formatted[] = [
                'id'       => $attachment->ID,
                'filename' => basename($filePath ?: $attachment->guid),
                'filesize' => $filePath && file_exists($filePath) ? filesize($filePath) : 0,
                'type'     => $attachment->post_mime_type,
                'url'      => $url,
            ];
        }

        return $formatted;
    }

    /**
     * Get terms associated with a topic, including meta (color, icon).
     * - topic_types: color
     * - statuses: color
     * - stages: icon, color.
     */
    private function getTopicTerms(int $postId): array
    {
        $singleTermTaxonomies = [
            Taxonomies::TOPIC_TYPES->value => ['key' => 'topic_types', 'meta' => ['color']],
            Taxonomies::STAGES->value      => ['key' => 'stages', 'meta' => ['icon', 'color']],
            Taxonomies::STATUSES->value    => ['key' => 'statuses', 'meta' => ['color']],
        ];

        // One term each from a taxonomy another plugin adds, under the
        // parameter that carries it — with its picture, when its terms have one.
        foreach (TopicTaxonomies::all() as $param => $entry) {
            $singleTermTaxonomies[$entry['taxonomy']] = ['key' => $param, 'meta' => $entry['icons'] ? ['icon'] : []];
        }

        $terms = [];
        foreach ($singleTermTaxonomies as $taxonomy => $config) {
            $taxonomyTerms = get_the_terms($postId, $taxonomy);
            $terms[$config['key']] = $this->formatTermWithMeta(
                \is_array($taxonomyTerms) && !empty($taxonomyTerms) ? $taxonomyTerms[0] : null,
                $config['meta']
            );
        }

        // Each tag says whether it is still awaiting review, so the portal can
        // mark it — a member who suggested it should see that it went somewhere.
        $tagsRaw = get_the_terms($postId, Taxonomies::TAGS->value);
        $terms['tags'] = \is_array($tagsRaw)
            ? array_map(
                static fn (WP_Term $tag): array => (array) $tag + ['pending' => TagApprovalService::isPending((int) $tag->term_id)],
                $tagsRaw
            )
            : [];

        return $terms;
    }

    /**
     * Format a WP_Term with meta (color, icon) for API response.
     *
     * @param string[]      $metaKeys 'color' and/or 'icon'
     *
     * @return null|array<string, mixed>
     */
    private function formatTermWithMeta(?WP_Term $term, array $metaKeys): ?array
    {
        if ($term === null) {
            return null;
        }

        // The name is stored escaped ("API &amp; Integrations"); JSON wants the text.
        $data = [
            'term_id'          => $term->term_id,
            'name'             => wp_specialchars_decode($term->name, ENT_QUOTES),
            'slug'             => $term->slug,
            'taxonomy'         => $term->taxonomy,
            'description'      => $term->description,
            'parent'           => $term->parent,
            'count'            => $term->count,
            'term_taxonomy_id' => $term->term_taxonomy_id,
        ];

        $meta = [];
        if (\in_array('color', $metaKeys, true)) {
            $color = get_term_meta($term->term_id, 'bit_connect_color', true);
            $meta['color'] = $color !== '' ? $color : null;
        }
        if (\in_array('icon', $metaKeys, true)) {
            $iconUrl = get_term_meta($term->term_id, 'bit_connect_icon_url', true);
            if ($iconUrl !== '') {
                $meta['icon'] = $iconUrl;
            } else {
                $iconId = (int) get_term_meta($term->term_id, 'bit_connect_icon_id', true);
                $meta['icon'] = $iconId > 0 ? wp_get_attachment_image_url($iconId, 'full') : null;
            }

            // The optional dark-theme counterpart; the portal falls back to
            // the light icon when it is unset.
            $iconDarkUrl = get_term_meta($term->term_id, 'bit_connect_icon_dark_url', true);
            $meta['icon_dark'] = $iconDarkUrl !== '' ? $iconDarkUrl : null;
        }
        if ($meta !== []) {
            $data['meta'] = $meta;
        }

        return $data;
    }

    /**
     * Get comments for a topic.
     */
    private function getTopicComments(int $postId): array
    {
        // 'all' then narrowed, rather than 'approve': a comment hidden by a
        // report has to stay in the list or every reply under it is orphaned.
        // filterVisibleComments() drops everything else that is not approved.
        $comments = ContentVisibilityService::filterVisibleComments(
            (array) get_comments(
                [
                    'post_id' => $postId,
                    'status'  => 'all',
                    'orderby' => 'comment_date_gmt',
                    'order'   => 'ASC',
                ]
            )
        );

        $canViewHidden = ContentVisibilityService::canViewHidden();

        // Once for the topic, not once per reply — the listener reads post
        // meta. 0 on a forum without the add-on, which makes every comparison
        // below a miss and every `pinned` false.
        $pinnedId = ExtensionPoints::pinnedCommentId($postId);

        $formattedComments = [];
        foreach ($comments as $comment) {
            $authorBadge = UserBadgeService::for((int) $comment->user_id);
            $isHidden = ContentVisibilityService::isCommentHidden($comment);
            // The writer of a hidden reply reads their own words, not a
            // tombstone standing where they were. Everyone else still gets the
            // marker.
            $keepsWords = $canViewHidden || ContentVisibilityService::isOwnContent((int) $comment->user_id);
            $content = $isHidden && !$keepsWords
                ? ContentVisibilityService::tombstone()
                : $comment->comment_content;

            $formattedComments[] = ExtensionPoints::commentFields([
                'comment_ID'      => $comment->comment_ID,
                'comment_post_ID' => $comment->comment_post_ID,
                'comment_author'  => $comment->comment_author,
                // The commenter's email, IP and user agent are deliberately
                // absent. They were sent on every topic page — a public,
                // unauthenticated route — while nothing on the portal read
                // them, which is the wholesale record copy this class says in
                // its own docblock that it never does.
                'comment_author_url' => $comment->comment_author_url,
                'comment_date'       => $comment->comment_date,
                'comment_date_gmt'   => $comment->comment_date_gmt,
                'comment_content'    => $content,
                'comment_karma'      => $comment->comment_karma,
                'comment_approved'   => $comment->comment_approved,
                'comment_type'       => $comment->comment_type,
                'comment_parent'     => $comment->comment_parent,
                'user_id'            => $comment->user_id,
                'author_avatar'      => get_avatar_url($comment->user_id ?: $comment->comment_author_email),
                // Empty for guest comments (user_id 0), which have no profile.
                'author_slug' => ProfileSlugService::slugFor((int) $comment->user_id),
                // No `vote` key: this plugin does not implement upvotes on
                // replies, so a reply renders with no upvote control. Another
                // plugin may attach fields of its own through commentFields()
                // below.
                'attachments' => self::formatCommentAttachments((int) $comment->comment_ID),
                // The topic page reads its comments from here, not from the
                // comments endpoint, so a badge missing from this shape is a
                // badge nobody sees: post-commons.ts defaults the absent field
                // to false, which is why staff comments have been rendering
                // plain on topic pages while the comments endpoint had it right.
                'author_badge' => $authorBadge,
                'isAdmin'      => $authorBadge !== null,
                'edited'       => EditAttributionService::forComment((int) $comment->comment_ID),
                // The portal greys the row and drops its actions when this is
                // true; a moderator — and now the author — still sees the words
                // underneath. "Out of public view", not "you may read this", so
                // it is true on a tombstone as well.
                'hidden' => $isHidden,
                // The reply the topic's author singled out. The topic page
                // reads its comments from here rather than from the comments
                // endpoint, so a pin missing from this shape is a pin nobody
                // sees until the reader paginates — the same trap the
                // author_badge note above records. Replies cannot be pinned,
                // hence the parent check: a stale id naming one matches
                // nothing.
                'pinned' => $pinnedId > 0
                    && (int) $comment->comment_ID === $pinnedId
                    && (int) $comment->comment_parent === 0,
            ], (int) $comment->comment_ID);
        }

        return $formattedComments;
    }
}
