<?php

namespace BitApps\BitConnect\Http\Controller;

// Prevent direct script access
if (!defined('ABSPATH')) {
    exit;
}

use BitApps\BitConnect\Deps\BitApps\WPKit\Http\Response;
use BitApps\BitConnect\Enum\NotificationTypes;
use BitApps\BitConnect\Enum\Taxonomies;
use BitApps\BitConnect\Http\Requests\CheckTopicSlugRequest;
use BitApps\BitConnect\Http\Requests\CreateTopicRequest;
use BitApps\BitConnect\Http\Requests\DeleteTopicRequest;
use BitApps\BitConnect\Http\Requests\GetAllTopicsRequest;
use BitApps\BitConnect\Http\Requests\GetTopicRequest;
use BitApps\BitConnect\Http\Requests\UpdateTopicRequest;
use BitApps\BitConnect\Services\ActivityLogService;
use BitApps\BitConnect\Services\MentionService;
use BitApps\BitConnect\Services\NotificationService;
use BitApps\BitConnect\Services\PermissionService;
use BitApps\BitConnect\Services\PortalLocation;
use BitApps\BitConnect\Services\TopicCreationService;
use BitApps\BitConnect\Services\TopicModerationService;
use BitApps\BitConnect\Services\TopicService;
use BitApps\BitConnect\Services\TopicTaxonomies;
use InvalidArgumentException;

final class TopicController
{
    private const HTTP_NOT_FOUND = 404;

    private const HTTP_SERVER_ERROR = 500;

    private TopicService $topicService;

    public function __construct()
    {
        $this->topicService = new TopicService();
    }

    public function all(GetAllTopicsRequest $request)
    {
        $validatedData = $request->validated();

        $search = $validatedData['search'] ?? '';
        $name = $validatedData['name'] ?? '';
        $sortBy = $validatedData['sortBy'] ?? 'newest';
        $page = $validatedData['page'] ?? 1;
        $perPage = $validatedData['per_page'] ?? 10;
        $visibility = $validatedData['visibility'] ?? '';
        $myTopics = $validatedData['my_topics'] ?? '';
        $view = $validatedData['view'] ?? '';

        $taxQuery = $this->taxQuery($validatedData);

        // Build filters array for TopicService
        $filters = [
            'numberposts' => $perPage,
            'paged'       => $page,
            'orderby'     => $sortBy === TopicService::ORDER_VOTES ? TopicService::ORDER_VOTES : 'date',
            'order'       => ($sortBy === 'oldest') ? 'ASC' : 'DESC',
            // phpcs:ignore WordPress.DB.SlowDBQuery.slow_db_query_tax_query -- Topics are filtered by taxonomy by design; there is no meta equivalent.
            'tax_query'        => $taxQuery,
            'include_comments' => false, // Don't include comments by default for performance
        ];

        if ($visibility !== '') {
            $filters['visibility'] = $visibility;
        }

        if ($myTopics === 'true' || $myTopics === '1') {
            $filters['my_topics'] = true;
        }

        $followed = $validatedData['followed'] ?? '';

        if ($followed === 'true' || $followed === '1') {
            $filters['followed'] = true;
        }

        if ($view !== '') {
            $filters['view'] = $view;
        }

        if ($search !== '') {
            $filters['s'] = $search;
        }
        if ($name !== '') {
            $filters['name'] = $name;
        }

        $topics = $this->topicService->getAllTopics($filters);

        // Total count across all pages (ignores the per-page limit).
        $total = $this->topicService->getLastQueryTotal();

        return Response::success(
            [
                'data'       => $topics,
                'pagination' => [
                    'total'        => $total,
                    'per_page'     => (int) $perPage,
                    'current_page' => (int) $page,
                    'total_pages'  => $perPage > 0 ? (int) ceil($total / $perPage) : 1,
                ],
            ]
        );
    }

    /**
     * The topic types the topics under these filters are filed as, so an
     * archive offers type chips only for types it holds.
     *
     * Takes the list's own filters and ignores `topic-types`: the answer is
     * the row of choices, which must not shrink to the one already picked.
     */
    public function typesUsed(GetAllTopicsRequest $request)
    {
        $filters = $request->validated();
        unset($filters['topic-types']);

        return Response::success($this->topicService->topicTypesUsed($this->taxQuery($filters)));
    }

    /**
     * Report whether a slug is free, and which one the save would really use.
     *
     * Advisory only — nothing here reserves the slug, so two authors settling
     * on the same one at once still both get an "available". The save stays
     * authoritative and the client discloses the slug it gets back.
     */
    public function slugCheck(CheckTopicSlugRequest $request)
    {
        $validatedData = $request->validated();

        return Response::success(
            TopicService::previewSlug(
                (string) $validatedData['slug'],
                (int) ($validatedData['topic_id'] ?? 0)
            )
        );
    }

    public function create(CreateTopicRequest $request)
    {
        $topic = (new TopicCreationService($this->topicService))->create($request->validated());

        if (is_wp_error($topic)) {
            $data = $topic->get_error_data();
            $status = (int) ($data['status'] ?? self::HTTP_SERVER_ERROR);
            $message = $topic->get_error_message();

            // An error about one field names it, as the request's own rules would.
            if (!empty($data['field'])) {
                return Response::error([$data['field'] => [$message]], $status)->message($message);
            }

            return Response::error($message, $status);
        }

        return Response::success($topic);
    }

    public function get(GetTopicRequest $request)
    {
        $validatedData = $request->validated();
        $id = $validatedData['id'];

        $topic = $this->topicService->getReadableTopicById($id);

        if (!$topic) {
            return Response::error('Post not found', self::HTTP_NOT_FOUND);
        }

        return Response::success($topic);
    }

    public function update(UpdateTopicRequest $request)
    {
        $validatedData = $request->validated();
        $id = $validatedData['id'];

        $existingTopic = $this->topicService->getTopicById($id);

        if (!$existingTopic) {
            return Response::error('Post not found', self::HTTP_NOT_FOUND);
        }

        $currentUser = wp_get_current_user();
        $isOwner = (int) $existingTopic['post_author'] === $currentUser->ID;
        // A moderator is admitted to this endpoint because status and stage
        // travel through it, and those are theirs to move. The words are not:
        // the content branch below answers to $isOwner alone.
        $canModerate = PermissionService::canModerate();

        if (!$canModerate && !$isOwner) {
            return Response::error(__('You are not allowed to edit this post.', 'bit-connect'), 403);
        }

        $updateData = [];

        // Moderator/admin: change statuses and stages on any topic
        if ($canModerate) {
            if (isset($validatedData['stages'])) {
                $updateData['stages'] = $validatedData['stages'];
            }
            if (isset($validatedData['statuses'])) {
                $updateData['statuses'] = $validatedData['statuses'];
            }
        }

        // Locking needs its own capability (a moderator-level action)
        if (isset($validatedData['is_locked'])) {
            if (!PermissionService::canLockPost()) {
                return Response::error('You do not have permission to lock posts', 403);
            }
            $updateData['is_locked'] = (bool) $validatedData['is_locked'];
        }

        /*
         * Content edits: the author, and nobody else, at any status.
         *
         * Both halves of that changed together and neither works alone. The
         * branch used to admit forum_edit_any as well, and to close for the
         * author once the status moved off the default — a pairing that made
         * sense only while a moderator could still correct the topic
         * afterwards. With the moderator's red pen gone, keeping the window
         * would leave every answered topic frozen, with nobody on the site able
         * to fix a mistake in it.
         */
        if ($isOwner) {
            if (!empty($validatedData['post_title']) && trim($validatedData['post_title'])) {
                $updateData['post_title'] = $validatedData['post_title'];
            }
            if (!empty($validatedData['post_content']) && trim($validatedData['post_content'])) {
                $updateData['post_content'] = $validatedData['post_content'];
                // Cleared, not copied: SeoContent::excerpt() falls back to the
                // content, and a copy of a long topic overflows the TEXT column
                // and fails the whole write. Clearing also drops the stale
                // copy older topics still carry.
                $updateData['post_excerpt'] = '';
            }
            // Blank means "leave the permalink alone", not "rebuild it from the
            // title" — links already pointing at this topic have to keep working.
            if (!empty($validatedData['post_name'])) {
                $updateData['post_name'] = $validatedData['post_name'];
            }
            if (isset($validatedData['post_status'])) {
                // Validation admits 'publish' and nothing else, so this either
                // leaves a public topic public or makes a private one public.
                // Both are this plugin's to do. A topic that is already private
                // stays editable here: the field simply is not sent, so its
                // status is untouched and its author can still fix a typo in
                // it.
                $updateData['post_status'] = $validatedData['post_status'];
            }
            if (isset($validatedData['topic-types'])) {
                $unknownType = TopicCreationService::unknownTopicType($validatedData['topic-types']);

                if ($unknownType !== null) {
                    return Response::error(['topic-types' => [$unknownType->get_error_message()]], 422)
                        ->message($unknownType->get_error_message());
                }

                $updateData['topic_types'] = $validatedData['topic-types'];
            }
            // Present and empty means "take it out of that taxonomy's term";
            // absent means "leave it as it is".
            foreach (array_keys(TopicTaxonomies::all()) as $param) {
                if (\array_key_exists($param, $validatedData)) {
                    $updateData[$param] = $validatedData[$param];
                }
            }
            if (isset($validatedData['attachments'])) {
                $updateData['attachments'] = $validatedData['attachments'];
            }
        }

        // Tags are filing, not words: a moderator who may move a topic between
        // stages may also file it under the tags it belongs to, and a member
        // who mis-tagged their own topic may fix it. Everyone this endpoint
        // admits is one or the other.
        $suggested = [];

        if (isset($validatedData['tags'])) {
            $resolved = TopicCreationService::resolveTags($validatedData['tags']);

            if (is_wp_error($resolved)) {
                return Response::error(['tags' => [$resolved->get_error_message()]], 422)->message($resolved->get_error_message());
            }

            $updateData['tags'] = $resolved['ids'];
            $suggested = $resolved['created'];
        }

        if (empty($updateData)) {
            return Response::error('No allowed fields to update', 403);
        }

        try {
            $topic = $this->topicService->updateTopic($id, $updateData);
        } catch (InvalidArgumentException $e) {
            return Response::error($e->getMessage(), 422);
        }

        if (!$topic) {
            return Response::error('Failed to update post', self::HTTP_SERVER_ERROR);
        }

        TopicModerationService::recordTopicActivity($id, (int) ($existingTopic['post_author'] ?? 0), $updateData, $topic);
        $this->notifyMentions($id, $existingTopic, $topic);
        TopicModerationService::notifyStatusChange($id, $updateData, $existingTopic, $topic);
        TopicCreationService::notifySuggestedTags($topic, $suggested);

        return Response::success($topic);
    }

    public function delete(DeleteTopicRequest $request)
    {
        $validatedData = $request->validated();
        $id = $validatedData['id'];

        $existingTopic = $this->topicService->getTopicById($id);
        if (!$existingTopic) {
            return Response::error('Post not found', self::HTTP_NOT_FOUND);
        }

        $currentUser = wp_get_current_user();
        $canModerate = PermissionService::canDeleteAny();
        $isOwner = (int) $existingTopic['post_author'] === $currentUser->ID;

        if (!$canModerate && !$isOwner) {
            return Response::error('You are not allowed to delete this post', 403);
        }

        if (!(new TopicModerationService($this->topicService))->deleteWithRecord((int) $id, $existingTopic)) {
            return Response::error('Failed to delete post', self::HTTP_SERVER_ERROR);
        }

        return Response::success(
            [
                'message'  => 'Post deleted successfully',
                'topic_id' => $id,
            ]
        );
    }

    /**
     * Tells whoever an edit newly named.
     *
     * Two shapes of "newly", because a topic can be written before it is
     * published:
     *
     *   - already public — only the names this edit added, so a corrected typo
     *     does not re-summon everyone the topic already names.
     *   - just published — every name in it, because a draft notifies nobody
     *     (notifyNewTopic refuses to send people to something they cannot read),
     *     so this is the first moment its mentions are real.
     *
     * @param array<string, mixed> $existingTopic the topic as it stood
     * @param array<string, mixed> $after         the topic as saved
     */
    private function notifyMentions(int $id, array $existingTopic, array $after): void
    {
        if ((string) ($after['post_status'] ?? '') !== 'publish') {
            return;
        }

        $before = (string) ($existingTopic['post_content'] ?? '');
        $now = (string) ($after['post_content'] ?? '');

        $mentioned = (string) ($existingTopic['post_status'] ?? '') === 'publish'
            ? MentionService::added($before, $now)
            : MentionService::parse($now);

        if ($mentioned === []) {
            return;
        }

        // From the author, whoever saved. Only the author writes a topic's words,
        // but the save that first makes them public can be someone else's — a
        // moderator changing the status of a topic another plugin was holding.
        NotificationService::dispatchAs(
            (int) ($after['post_author'] ?? 0),
            NotificationTypes::MENTION,
            NotificationService::TARGET_TOPIC,
            $id,
            [
                'topic_title' => (string) ($after['post_title'] ?? ''),
                'excerpt'     => ActivityLogService::excerpt(wp_strip_all_tags($now)),
                'url'         => PortalLocation::topicUrl((int) ($after['ID'] ?? 0)),
            ],
            $id,
            $mentioned
        );
    }

    /**
     * A `tax_query` for WP_Query from the list's term filters — each a
     * comma-separated list of slugs, any of which matches.
     */
    private function taxQuery(array $validatedData): array
    {
        $taxonomyFilters = [
            Taxonomies::STAGES->value      => $validatedData['stages'] ?? null,
            Taxonomies::TOPIC_TYPES->value => $validatedData['topic-types'] ?? null,
            Taxonomies::STATUSES->value    => $validatedData['statuses'] ?? null,
            Taxonomies::TAGS->value        => $validatedData['tags'] ?? null,
        ];

        foreach (TopicTaxonomies::all() as $param => $entry) {
            $taxonomyFilters[$entry['taxonomy']] = $validatedData[$param] ?? null;
        }

        $taxQuery = [];
        foreach ($taxonomyFilters as $taxonomy => $term) {
            if (!empty($term)) {
                $taxQuery[] = [
                    'taxonomy' => $taxonomy,
                    'field'    => 'slug',
                    'terms'    => array_map('trim', explode(',', $term)),
                    'operator' => 'IN',
                ];
            }
        }

        if (\count($taxQuery) > 1) {
            $taxQuery['relation'] = 'AND';
        }

        return $taxQuery;
    }
}
