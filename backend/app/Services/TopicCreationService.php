<?php

namespace BitApps\BitConnect\Services;

// Prevent direct script access
if (!defined('ABSPATH')) {
    exit;
}

use BitApps\BitConnect\Enum\NotificationTypes;
use BitApps\BitConnect\Enum\Taxonomies;
use BitApps\BitConnect\Model\Follow;
use InvalidArgumentException;
use WP_Error;
use WP_Term;

/**
 * Creates a topic the way the portal does: tags resolved, default stage and
 * status applied, then the people who should hear about it told.
 *
 * The controller used to do all of this itself. It lives here so that every
 * route that creates a topic on a member's behalf — the portal's own, and any
 * an integration adds — produces the same topic and the same notifications,
 * rather than a bare TopicService::createTopic() row that nobody hears about.
 *
 * Acts as the current user: the author, the follow and the tag permission are
 * all theirs. A caller acting for someone else switches the current user first.
 */
final class TopicCreationService
{
    private const HTTP_UNPROCESSABLE = 422;

    private const HTTP_SERVER_ERROR = 500;

    private TopicService $topicService;

    public function __construct(?TopicService $topicService = null)
    {
        $this->topicService = $topicService ?? new TopicService();
    }

    /**
     * @param array<string, mixed> $input the fields CreateTopicRequest validates,
     *                                    under the same names
     *
     * @return array<string, mixed>|WP_Error the topic as TopicService returns it;
     *                                       the error carries its HTTP status and,
     *                                       for a tag, the field it belongs to
     */
    public function create(array $input)
    {
        $unknownType = self::unknownTopicType($input['topic-types'] ?? null);

        if ($unknownType !== null) {
            return $unknownType;
        }

        $resolved = self::resolveTags($input['tags'] ?? []);

        if (is_wp_error($resolved)) {
            $resolved->add_data(['status' => self::HTTP_UNPROCESSABLE, 'field' => 'tags']);

            return $resolved;
        }

        $topicData = [
            'post_title'   => $input['post_title'],
            'post_content' => $input['post_content'] ?? '',
            'post_status'  => $input['post_status'] ?? 'publish',
            'topic_types'  => $input['topic-types'] ?? [],
            'tags'         => $resolved['ids'],
            'attachments'  => $input['attachments'] ?? [],
        ];

        foreach (array_keys(TopicTaxonomies::all()) as $param) {
            $topicData[$param] = $input[$param] ?? [];
        }

        // Only when the author actually chose one. A slug of separators alone
        // sanitizes to '', which must fall through to the title rather than
        // reach wp_insert_post as an empty explicit slug.
        if (!empty($input['post_name'])) {
            $topicData['post_name'] = $input['post_name'];
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
            return new WP_Error('bit_connect_topic_invalid', $e->getMessage(), ['status' => self::HTTP_UNPROCESSABLE]);
        }

        if (!$topic) {
            return new WP_Error('bit_connect_topic_failed', 'Failed to create post', ['status' => self::HTTP_SERVER_ERROR]);
        }

        $this->notifyNewTopic($topic);
        self::notifySuggestedTags($topic, $resolved['created']);

        return $topic;
    }

    /**
     * Refuses a topic type that does not exist.
     *
     * The request checks only that the field is a number. WordPress files a
     * post under an unknown term id as under nothing, so a stale form or a
     * hand-made request saved a topic with no type — past a form setting that
     * makes the type required.
     *
     * @param mixed $typeId the `topic-types` field as validated
     */
    public static function unknownTopicType($typeId): ?WP_Error
    {
        if ($typeId === null || $typeId === '' || (int) $typeId === 0) {
            return null;
        }

        $term = get_term((int) $typeId, Taxonomies::TOPIC_TYPES->value);

        if ($term instanceof WP_Term && $term->taxonomy === Taxonomies::TOPIC_TYPES->value) {
            return null;
        }

        $message = __('The topic does not exist.', 'bit-connect');

        return new WP_Error('bit_connect_topic_type_unknown', $message, ['status' => self::HTTP_UNPROCESSABLE, 'field' => 'topic-types']);
    }

    /**
     * The topic's tags as ids, with any name the member typed matched to a
     * tag or created as a pending one — see TagResolverService.
     *
     * @param mixed $refs the `tags` field as validated
     *
     * @return array{ids: array<int, int>, created: array<int, array{id: int, name: string}>}|WP_Error
     */
    public static function resolveTags($refs)
    {
        return TagResolverService::resolve(
            \is_array($refs) ? $refs : [],
            get_current_user_id(),
            PermissionService::canCreateTag()
        );
    }

    /**
     * Tells moderators a tag is waiting for review, one row per tag.
     *
     * Sent after the topic is saved, not when the tag is created: a suggestion
     * on a topic that then failed to save is nothing to review. The row points
     * at the topic, where the tag can be seen in use; the decision is made on
     * the admin's Tags screen.
     *
     * @param array<string, mixed>                     $topic     as the service returned it
     * @param array<int, array{id: int, name: string}> $suggested what TagResolverService created
     */
    public static function notifySuggestedTags(array $topic, array $suggested): void
    {
        $topicId = (int) ($topic['ID'] ?? 0);

        if ($topicId <= 0) {
            return;
        }

        foreach ($suggested as $tag) {
            NotificationService::dispatch(
                NotificationTypes::TAG_SUGGESTED,
                NotificationService::TARGET_TOPIC,
                $topicId,
                [
                    'topic_title' => (string) ($topic['post_title'] ?? ''),
                    'tag_name'    => $tag['name'],
                    'tag_id'      => $tag['id'],
                ],
                $topicId
            );
        }
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
     * Moderators are the exception: they get TOPIC_POSTED for every topic,
     * because keeping an eye on everything is their job. It is a separate type so
     * they can switch it off without losing the topics they follow.
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
            'url' => PortalLocation::topicUrl((int) ($topic['ID'] ?? 0)),
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

        $followers = NotificationRecipients::newTopicAudience($topicId);

        NotificationService::dispatch(
            NotificationTypes::TOPIC_NEW,
            NotificationService::TARGET_TOPIC,
            $topicId,
            $context,
            $topicId,
            $followers,
            $mentioned
        );

        // Moderators hear about every topic, followed or not, so nothing new
        // reaches the portal unseen. A moderator who was already told as a
        // follower is skipped: one topic is one row. Only the followers who
        // actually took the TOPIC_NEW row count as told — one who switched that
        // type off must still get this one.
        $toldAsFollower = array_filter(
            $followers,
            static fn (int $id): bool => NotificationPreferences::wantsInApp($id, NotificationTypes::TOPIC_NEW)
        );

        NotificationService::dispatch(
            NotificationTypes::TOPIC_POSTED,
            NotificationService::TARGET_TOPIC,
            $topicId,
            $context,
            $topicId,
            null,
            array_merge($mentioned, $toldAsFollower)
        );
    }
}
