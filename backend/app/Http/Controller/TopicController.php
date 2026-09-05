<?php

namespace BitApps\BitConnect\Http\Controller;

// Prevent direct script access
if (!defined('ABSPATH')) {
    exit;
}

use BitApps\BitConnect\Deps\BitApps\WPKit\Http\Response;
use BitApps\BitConnect\Enum\ActivityActions;
use BitApps\BitConnect\Enum\NotificationTypes;
use BitApps\BitConnect\Enum\Taxonomies;
use BitApps\BitConnect\Http\Requests\CheckTopicSlugRequest;
use BitApps\BitConnect\Http\Requests\CreateTopicRequest;
use BitApps\BitConnect\Http\Requests\DeleteTopicRequest;
use BitApps\BitConnect\Http\Requests\GetAllTopicsRequest;
use BitApps\BitConnect\Http\Requests\GetTopicRequest;
use BitApps\BitConnect\Http\Requests\UpdateTopicRequest;
use BitApps\BitConnect\Model\Follow;
use BitApps\BitConnect\Services\ActivityLogService;
use BitApps\BitConnect\Services\FollowService;
use BitApps\BitConnect\Services\MentionService;
use BitApps\BitConnect\Services\NotificationService;
use BitApps\BitConnect\Services\PermissionService;
use BitApps\BitConnect\Services\StageService;
use BitApps\BitConnect\Services\StatusService;
use BitApps\BitConnect\Services\TopicService;
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

        // Build taxonomy filters
        $taxonomyFilters = [
            Taxonomies::STAGES->value      => $validatedData['stages'] ?? null,
            Taxonomies::DEPARTMENTS->value => $validatedData['departments'] ?? null,
            Taxonomies::TOPIC_TYPES->value => $validatedData['topic-types'] ?? null,
            Taxonomies::STATUSES->value    => $validatedData['statuses'] ?? null,
            Taxonomies::TAGS->value        => $validatedData['tags'] ?? null,
        ];

        // Build tax_query array for WP_Query
        $taxQuery = [];
        foreach ($taxonomyFilters as $taxonomy => $term) {
            if (!empty($term)) {
                $terms = array_map('trim', explode(',', $term));
                $taxQuery[] = [
                    'taxonomy' => $taxonomy,
                    'field'    => 'slug',
                    'terms'    => $terms,
                    'operator' => 'IN',
                ];
            }
        }

        if (\count($taxQuery) > 1) {
            $taxQuery['relation'] = 'AND';
        }

        // Build filters array for TopicService
        $filters = [
            'numberposts' => $perPage,
            'paged'       => $page,
            'orderby'     => 'date',
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
        $validatedData = $request->validated();

        if (!$this->mayUseStatus($validatedData['post_status'] ?? null)) {
            return $this->refusePrivateTopic();
        }

        // Prepare data for service
        $topicData = [
            'post_title'   => $validatedData['post_title'],
            'post_content' => $validatedData['post_content'],
            'post_excerpt' => $validatedData['post_content'],
            'post_status'  => $validatedData['post_status'] ?? 'publish',
            'topic_types'  => $validatedData['topic-types'] ?? [],
            'departments'  => $validatedData['departments'] ?? [],
            'tags'         => $validatedData['tags'] ?? [],
            'attachments'  => $validatedData['attachments'] ?? [],
        ];

        // Only when the author actually chose one. A slug of separators alone
        // sanitizes to '', which must fall through to the title rather than
        // reach wp_insert_post as an empty explicit slug.
        if (!empty($validatedData['post_name'])) {
            $topicData['post_name'] = $validatedData['post_name'];
        }

        // By flag, not by slug — an admin can rename either default term.
        $defaultStage = StageService::defaultStage();
        $defaultStatus = StatusService::defaultStatus();

        if ($defaultStage) {
            $topicData['stages'] = [$defaultStage->term_id];
        }

        if ($defaultStatus) {
            $topicData['statuses'] = [$defaultStatus->term_id];
        }

        try {
            $topic = $this->topicService->createTopic($topicData);
        } catch (InvalidArgumentException $e) {
            return Response::error($e->getMessage(), 422);
        }

        if (!$topic) {
            return Response::error('Failed to create topic', self::HTTP_SERVER_ERROR);
        }

        $this->notifyNewTopic($topic);

        return Response::success($topic);
    }

    public function get(GetTopicRequest $request)
    {
        $validatedData = $request->validated();
        $id = $validatedData['id'];

        $topic = $this->topicService->getTopicById($id);

        if (!$topic) {
            return Response::error('Topic not found', self::HTTP_NOT_FOUND);
        }

        return Response::success($topic);
    }

    public function update(UpdateTopicRequest $request)
    {
        $validatedData = $request->validated();
        $id = $validatedData['id'];

        $existingTopic = $this->topicService->getTopicById($id);

        if (!$existingTopic) {
            return Response::error('Topic not found', self::HTTP_NOT_FOUND);
        }

        $currentUser = wp_get_current_user();
        $isOwner = (int) $existingTopic['post_author'] === $currentUser->ID;
        // A moderator is admitted to this endpoint because status and stage
        // travel through it, and those are theirs to move. The words are not:
        // the content branch below answers to $isOwner alone.
        $canModerate = PermissionService::canModerate();

        if (!$canModerate && !$isOwner) {
            return Response::error(__('You are not allowed to edit this topic.', 'bit-connect'), 403);
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

        // Pin/lock require dedicated capabilities (moderator-level actions)
        if (isset($validatedData['is_pinned'])) {
            if (!PermissionService::canPinPost()) {
                return Response::error('You do not have permission to pin topics', 403);
            }
            $updateData['is_pinned'] = (bool) $validatedData['is_pinned'];
        }

        if (isset($validatedData['is_locked'])) {
            if (!PermissionService::canLockPost()) {
                return Response::error('You do not have permission to lock topics', 403);
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
                $updateData['post_excerpt'] = $validatedData['post_content'];
            }
            // Blank means "leave the permalink alone", not "rebuild it from the
            // title" — links already pointing at this topic have to keep working.
            if (!empty($validatedData['post_name'])) {
                $updateData['post_name'] = $validatedData['post_name'];
            }
            if (isset($validatedData['post_status'])) {
                // Only a *move* into private is refused. A topic that is already
                // private stays editable after the feature is switched off or a
                // license lapses — otherwise turning the setting off would trap
                // its author, unable to fix a typo in something they wrote,
                // which is not what "stop offering private topics" should mean.
                $wasPrivate = (string) ($existingTopic['post_status'] ?? '') === 'private';

                if (!$wasPrivate && !$this->mayUseStatus($validatedData['post_status'])) {
                    return $this->refusePrivateTopic();
                }

                $updateData['post_status'] = $validatedData['post_status'];
            }
            if (isset($validatedData['topic-types'])) {
                $updateData['topic_types'] = $validatedData['topic-types'];
            }
            if (isset($validatedData['departments'])) {
                $updateData['departments'] = $validatedData['departments'];
            }
            if (isset($validatedData['tags'])) {
                $updateData['tags'] = $validatedData['tags'];
            }
            if (isset($validatedData['attachments'])) {
                $updateData['attachments'] = $validatedData['attachments'];
            }
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
            return Response::error('Failed to update topic', self::HTTP_SERVER_ERROR);
        }

        $this->recordTopicActivity($id, (int) ($existingTopic['post_author'] ?? 0), $updateData, $topic);
        $this->notifyMentions($id, $existingTopic, $topic);
        $this->notifyStatusChange($id, $updateData, $existingTopic, $topic);

        return Response::success($topic);
    }

    public function delete(DeleteTopicRequest $request)
    {
        $validatedData = $request->validated();
        $id = $validatedData['id'];

        $existingTopic = $this->topicService->getTopicById($id);
        if (!$existingTopic) {
            return Response::error('Topic not found', self::HTTP_NOT_FOUND);
        }

        $currentUser = wp_get_current_user();
        $canModerate = PermissionService::canDeleteAny();
        $isOwner = (int) $existingTopic['post_author'] === $currentUser->ID;

        if (!$canModerate && !$isOwner) {
            return Response::error('You are not allowed to delete this topic', 403);
        }

        // Read before the delete, written after it succeeds. Reading first
        // because once deleteTopic() returns there is no row left to take a
        // title or an author from, and this log row is the only place the topic
        // will have existed. Writing after because a delete that fails must not
        // leave a record saying it happened.
        $deleted = [
            'post_title'   => $existingTopic['post_title'] ?? '',
            'post_content' => ActivityLogService::excerpt($existingTopic['post_content'] ?? ''),
        ];
        $deletedAuthor = (int) ($existingTopic['post_author'] ?? 0);

        $result = $this->topicService->deleteTopic($id);

        if (!$result) {
            return Response::error('Failed to delete topic', self::HTTP_SERVER_ERROR);
        }

        ActivityLogService::recordIfNotAuthor(
            ActivityActions::DELETE_POST,
            ActivityLogService::TARGET_POST,
            $id,
            $deletedAuthor,
            $deleted
        );

        return Response::success(
            [
                'message'  => 'Topic deleted successfully',
                'topic_id' => $id,
            ]
        );
    }

    /**
     * Announces a new topic to the people who asked to hear about its subject.
     *
     * Deliberately not to everyone. NotificationRecipients::newTopicAudience()
     * answers with the followers of the products and tags the topic was filed
     * under, plus anyone following the forum itself. A broadcast to every member
     * stops being usable past a handful of topics a week, and a bell full of
     * things nobody asked for is the fastest way to teach people to ignore it.
     *
     * @param array<string, mixed> $topic as returned by TopicService::createTopic()
     */
    private function notifyNewTopic(array $topic): void
    {
        $topicId = (int) ($topic['ID'] ?? 0);

        if ($topicId <= 0) {
            return;
        }

        // The author follows their own topic. Not a formality: it is what makes
        // replies reach them through the same path as every other follower,
        // rather than through an "and also the author" special case that each
        // recipient rule would have to remember separately.
        FollowService::autoFollow(get_current_user_id(), Follow::TARGET_TOPIC, $topicId);

        // A draft is not news. Topics can be created unpublished, and announcing
        // one would send people to something they cannot read.
        if ((string) ($topic['post_status'] ?? '') !== 'publish') {
            return;
        }

        $context = [
            'topic_title' => (string) ($topic['post_title'] ?? ''),
            'excerpt'     => ActivityLogService::excerpt(
                wp_strip_all_tags((string) ($topic['post_content'] ?? ''))
            ),
            'url' => (string) ($topic['permalink'] ?? ''),
        ];

        // Named before announced, and the names are then excluded below. Being
        // spoken to is the more specific of the two things that just happened,
        // and one topic must not arrive twice for the person it was written to.
        $mentioned = MentionService::parse((string) ($topic['post_content'] ?? ''));

        if ($mentioned !== []) {
            NotificationService::dispatch(
                NotificationTypes::MENTION,
                NotificationService::TARGET_TOPIC,
                $topicId,
                $context,
                $topicId,
                $mentioned
            );
        }

        NotificationService::dispatch(
            NotificationTypes::TOPIC_NEW,
            NotificationService::TARGET_TOPIC,
            $topicId,
            $context,
            $topicId,
            null,
            $mentioned
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

        NotificationService::dispatch(
            NotificationTypes::MENTION,
            NotificationService::TARGET_TOPIC,
            $id,
            [
                'topic_title' => (string) ($after['post_title'] ?? ''),
                'excerpt'     => ActivityLogService::excerpt(wp_strip_all_tags($now)),
                'url'         => (string) ($after['permalink'] ?? ''),
            ],
            $id,
            $mentioned
        );
    }

    /**
     * Tells a thread when its stage or status moves.
     *
     * The one edit to a topic that the people watching it actually want pushed
     * to them: "Planned → Shipped" is the answer they subscribed for. Everything
     * else this endpoint can change is either invisible to them (a slug), or
     * their own doing (the author rewording their post), or already obvious on
     * the page (a lock).
     *
     * Only fires when a term actually moved. `isset($updateData['statuses'])`
     * alone is true whenever the form posted the field back unchanged, which on
     * this endpoint is every single save — so the comparison is the whole guard.
     *
     * @param array<string, mixed> $updateData
     * @param array<string, mixed> $existingTopic
     * @param array<string, mixed> $after
     */
    private function notifyStatusChange(int $id, array $updateData, array $existingTopic, array $after): void
    {
        $moved = [];

        foreach (['statuses', 'stages'] as $taxonomy) {
            if (!isset($updateData[$taxonomy])) {
                continue;
            }

            if ($this->termId($existingTopic, $taxonomy) !== $this->termId($after, $taxonomy)) {
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
                'status' => $this->termName($after, 'statuses'),
                'stage'  => $this->termName($after, 'stages'),
                'from'   => [
                    'status' => $this->termName($existingTopic, 'statuses'),
                    'stage'  => $this->termName($existingTopic, 'stages'),
                ],
                'url' => (string) ($after['permalink'] ?? ''),
            ],
            $id
        );
    }

    /**
     * The id of a topic's single status or stage term, or 0 when it has none.
     *
     * Both live under `terms` as one nullable formatted term rather than a list
     * — see TopicService::getTopicTerms(), which takes [0] of each taxonomy.
     *
     * @param array<string, mixed> $topic
     */
    private function termId(array $topic, string $key): int
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
    private function termName(array $topic, string $key): string
    {
        $terms = \is_array($topic['terms'] ?? null) ? $topic['terms'] : [];
        $term = \is_array($terms[$key] ?? null) ? $terms[$key] : [];

        return (string) ($term['name'] ?? '');
    }

    /**
     * Records what a moderator did to somebody else's topic.
     *
     * Reads the same $updateData the service acted on, so it cannot claim an
     * edit the controller dropped: only the author reaches the content branch,
     * so post_title and post_content never enter that array for anybody else.
     *
     * There is no arm for the words themselves. Editing another member's topic
     * was withdrawn, which left that branch unreachable for a non-author and its
     * before/after snapshot writing nothing. What is recorded here is the pin
     * and lock moves that remain a moderator's.
     *
     * @param array<string, mixed> $updateData the fields actually applied
     * @param array<string, mixed> $after      the refreshed topic
     */
    private function recordTopicActivity(int $id, int $author, array $updateData, array $after): void
    {
        // Pin and lock are recorded in whichever direction they were moved, so
        // the feed reads as a history rather than a list of "changed pinning".
        if (isset($updateData['is_pinned'])) {
            ActivityLogService::recordIfNotAuthor(
                $updateData['is_pinned'] ? ActivityActions::PIN_POST : ActivityActions::UNPIN_POST,
                ActivityLogService::TARGET_POST,
                $id,
                $author,
                ['post_title' => $after['post_title'] ?? '']
            );
        }

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
     * Whether the forum currently accepts a topic in this status.
     *
     * Only 'private' is gated. Anything else — 'publish', or the hidden status
     * moderation applies — is not this method's business, so it passes through
     * and the existing handling decides.
     *
     * The portal already hides the Private option when it is unavailable, but
     * that is presentation: the request can still arrive from a stale tab, a
     * second browser, or anything speaking to the API directly.
     *
     * @param null|string $status
     */
    private function mayUseStatus($status): bool
    {
        if ((string) $status !== 'private') {
            return true;
        }

        return PermissionService::canUsePrivateTopics();
    }

    private function refusePrivateTopic()
    {
        return Response::error(
            __('Private topics are not available on this forum.', 'bit-connect')
        )->httpStatus(403);
    }
}
