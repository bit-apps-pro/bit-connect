<?php

namespace BitApps\BitConnect\Services;

// Prevent direct script access
if (!defined('ABSPATH')) {
    exit;
}


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
    /**
     * Total number of topics matching the most recent getAllTopics() query,
     * ignoring pagination limits. Populated by getAllTopics().
     */
    private int $lastQueryTotal = 0;

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

        // Explicit author filter, used by the public profile pages. Previously
        // getTopicsByAuthor() set this and nothing read it, so it silently
        // returned every topic. `perm => readable` above still applies, so a
        // visitor only ever sees the author's topics they are allowed to read.
        if (!empty($filters['author'])) {
            $args['author'] = (int) $filters['author'];
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

        $query = new WP_Query($args);
        $this->lastQueryTotal = (int) $query->found_posts;

        $topics = [];
        foreach ($query->posts as $post) {
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
        // status filter at all. Without this, a topic hidden from every listing
        // would still be served in full to anyone holding its URL.
        //
        // The author is not a stranger to their own topic: they keep the URL,
        // marked as hidden, while it stays out of every listing for everyone.
        $isHiddenFromViewer = $post->post_status === ContentVisibilityService::HIDDEN_STATUS
            && !ContentVisibilityService::isPostViewableWhileHidden((int) $post->post_author);

        if ($isHiddenFromViewer) {
            return null;
        }

        return $this->prepareTopicData($post, true);
    }

    /**
     * Get a single topic by ID.
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
     * Create a new topic.
     */
    public function createTopic(array $data, ?int $userId = null): ?array
    {
        $userId = $userId ?: get_current_user_id();

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

        if (is_wp_error($postId)) {
            return null;
        }
        // Set taxonomy terms if provided
        if (isset($data['topic_types'])) {
            $res = wp_set_post_terms($postId, $data['topic_types'], Taxonomies::TOPIC_TYPES->value); // phpcs:ignore VariableAnalysis.CodeAnalysis.VariableAnalysis.UnusedVariable
        }

        if (isset($data['departments'])) {
            wp_set_post_terms($postId, $data['departments'], Taxonomies::DEPARTMENTS->value);
        }

        if (isset($data['stages'])) {
            wp_set_post_terms($postId, $data['stages'], Taxonomies::STAGES->value);
        }

        if (isset($data['statuses'])) {
            wp_set_post_terms($postId, $data['statuses'], Taxonomies::STATUSES->value);
        }

        if (isset($data['tags']) && \is_array($data['tags'])) {
            wp_set_post_terms($postId, $data['tags'], Taxonomies::TAGS->value);
        }

        // Link attachments to the topic via post_parent
        if (!empty($data['attachments']) && \is_array($data['attachments'])) {
            foreach ($data['attachments'] as $attachmentId) {
                wp_update_post(
                    [
                        'ID'          => (int) $attachmentId,
                        'post_parent' => $postId,
                    ]
                );
            }
        }

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

        $postData = [
            'ID'           => $id,
            'post_title'   => $data['post_title'] ?? $existingPost->post_title,
            'post_content' => $data['post_content'] ?? $existingPost->post_content,
            'post_excerpt' => $data['post_excerpt'] ?? $existingPost->post_excerpt,
            'post_status'  => $data['post_status'] ?? $existingPost->post_status,
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

        if (is_wp_error($result)) {
            return null;
        }

        // Only a change to the words counts as an edit. An update carrying just
        // is_pinned or is_locked still calls wp_update_post() below and bumps
        // post_modified, which is why that column cannot answer this and the
        // meta has to be written deliberately.
        if ($contentChanged) {
            EditAttributionService::recordPost($id, get_current_user_id());
        }

        // Pin/unpin: WordPress sticky posts list
        if (isset($data['is_pinned'])) {
            $stickies = get_option('sticky_posts', []);
            if ($data['is_pinned']) {
                if (!\in_array($id, $stickies, true)) {
                    $stickies[] = $id;
                    update_option('sticky_posts', $stickies);
                }
            } else {
                $stickies = array_values(array_diff($stickies, [$id]));
                update_option('sticky_posts', $stickies);
            }
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

        if (isset($data['departments'])) {
            wp_set_post_terms($id, $data['departments'], Taxonomies::DEPARTMENTS->value);
        }

        if (isset($data['stages'])) {
            wp_set_post_terms($id, $data['stages'], Taxonomies::STAGES->value);
        }

        if (isset($data['statuses'])) {
            wp_set_post_terms($id, $data['statuses'], Taxonomies::STATUSES->value);
        }

        if (isset($data['tags'])) {
            wp_set_post_terms($id, $data['tags'], Taxonomies::TAGS->value);
        }

        // Update attachments: unlink old, link new
        if (isset($data['attachments'])) {
            $newAttachmentIds = \is_array($data['attachments']) ? array_map('intval', $data['attachments']) : [];

            // Unlink existing attachments that are not in the new list
            $existingAttachments = get_attached_media('', $id);
            foreach ($existingAttachments as $existing) {
                if (!\in_array($existing->ID, $newAttachmentIds, true)) {
                    wp_update_post(
                        [
                            'ID'          => $existing->ID,
                            'post_parent' => 0,
                        ]
                    );
                }
            }

            // Link new attachments to the topic
            foreach ($newAttachmentIds as $attachmentId) {
                wp_update_post(
                    [
                        'ID'          => $attachmentId,
                        'post_parent' => $id,
                    ]
                );
            }
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

        $voteService = new VoteService();

        // Delete votes for all comments on this post
        $comments = get_comments(['post_id' => $id, 'fields' => 'ids']);
        foreach ($comments as $commentId) {
            $voteService->deleteCommentVotes((int) $commentId);
        }

        // Delete post votes
        $voteService->deletePostVotes($id);

        $result = wp_delete_post($id, true);

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

        return [
            'total'         => (int) $totalTopics->publish,
            'status_counts' => [
                'publish' => (int) $totalTopics->publish,
                'draft'   => (int) $totalTopics->draft,
                'pending' => (int) $totalTopics->pending,
            ],
            'taxonomy_counts' => [
                'topic_types' => wp_count_terms([Taxonomies::TOPIC_TYPES->value]),
                'departments' => wp_count_terms([Taxonomies::DEPARTMENTS->value]),
                'stages'      => wp_count_terms([Taxonomies::STAGES->value]),
                'statuses'    => wp_count_terms([Taxonomies::STATUSES->value]),
                'tags'        => wp_count_terms([Taxonomies::TAGS->value]),
            ]
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

    public static function getCommentVoteStatus(int $commentId): ?array
    {
        $hasVoted = false;
        if (is_user_logged_in()) {
            $currentUserId = get_current_user_id();
            $userVote = Vote::hasUserVotedComment($currentUserId, $commentId);
            $hasVoted = !empty($userVote);
        }

        return [
            'total'    => Vote::getCommentVoteCount($commentId),
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
        $attachmentIds = get_comment_meta($commentId, '_comment_attachments', true);
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
            'is_pinned'         => \in_array($post->ID, (array) get_option('sticky_posts', []), true),
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
            // which pinning and locking both bump.
            'edited' => EditAttributionService::forPost((int) $post->ID),
            // True only for the two audiences that get a hidden topic served at
            // all — its author and a moderator — so the page can say why it is
            // showing them something the public cannot see.
            'hidden'         => $post->post_status === ContentVisibilityService::HIDDEN_STATUS,
            'comments_count' => get_comments_number($post->ID),
            'vote'           => self::getPostVoteStatus($post->ID),
            'terms'          => $this->getTopicTerms($post->ID),
            'attachments'    => $this->formatAttachments($post->ID),
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

        return $data;
    }

    /**
     * Format attached media for API response.
     *
     * @return array<int, array{id: int, filename: string, filesize: int, type: string, url: string}>
     */
    private function formatAttachments(int $postId): array
    {
        $attachments = get_attached_media('', $postId);
        $formatted = [];

        foreach ($attachments as $attachment) {
            $filePath = get_attached_file($attachment->ID);
            $formatted[] = [
                'id'       => $attachment->ID,
                'filename' => basename($filePath ?: $attachment->guid),
                'filesize' => $filePath && file_exists($filePath) ? filesize($filePath) : 0,
                'type'     => $attachment->post_mime_type,
                'url'      => wp_get_attachment_url($attachment->ID),
            ];
        }

        return $formatted;
    }

    /**
     * Get terms associated with a topic, including meta (color, icon).
     * - topic_types: color, icon
     * - statuses: color
     * - stages: icon.
     */
    private function getTopicTerms(int $postId): array
    {
        $singleTermTaxonomies = [
            Taxonomies::TOPIC_TYPES->value => ['key' => 'topic_types', 'meta' => ['color', 'icon']],
            Taxonomies::DEPARTMENTS->value => ['key' => 'departments', 'meta' => []],
            Taxonomies::STAGES->value      => ['key' => 'stages', 'meta' => ['icon']],
            Taxonomies::STATUSES->value    => ['key' => 'statuses', 'meta' => ['color']],
        ];

        $terms = [];
        foreach ($singleTermTaxonomies as $taxonomy => $config) {
            $taxonomyTerms = get_the_terms($postId, $taxonomy);
            $terms[$config['key']] = $this->formatTermWithMeta(
                \is_array($taxonomyTerms) && !empty($taxonomyTerms) ? $taxonomyTerms[0] : null,
                $config['meta']
            );
        }

        $tagsRaw = get_the_terms($postId, Taxonomies::TAGS->value);
        $terms['tags'] = \is_array($tagsRaw) ? $tagsRaw : [];

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

        $data = [
            'term_id'          => $term->term_id,
            'name'             => $term->name,
            'slug'             => $term->slug,
            'taxonomy'         => $term->taxonomy,
            'description'      => $term->description,
            'parent'           => $term->parent,
            'count'            => $term->count,
            'term_taxonomy_id' => $term->term_taxonomy_id,
        ];

        $meta = [];
        if (\in_array('color', $metaKeys, true)) {
            $color = get_term_meta($term->term_id, 'color', true);
            $meta['color'] = $color !== '' ? $color : null;
        }
        if (\in_array('icon', $metaKeys, true)) {
            $iconUrl = get_term_meta($term->term_id, 'icon_url', true);
            if ($iconUrl !== '') {
                $meta['icon'] = $iconUrl;
            } else {
                $iconId = (int) get_term_meta($term->term_id, 'icon_id', true);
                $meta['icon'] = $iconId > 0 ? wp_get_attachment_image_url($iconId, 'full') : null;
            }
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

            $formattedComments[] = [
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
                'vote'        => self::getCommentVoteStatus($comment->comment_ID),
                'attachments' => self::formatCommentAttachments($comment->comment_ID),
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
            ];
        }

        return $formattedComments;
    }
}
