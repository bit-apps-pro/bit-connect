<?php

namespace BitApps\BitConnect\Services;

// Prevent direct script access
if (!defined('ABSPATH')) {
    exit;
}

use BitApps\BitConnect\Config;
use BitApps\BitConnect\Deps\BitApps\WPKit\Hooks\Hooks;
use BitApps\BitConnect\Enum\Capabilities;
use BitApps\BitConnect\Enum\NotificationTypes;
use WP_Comment;
use WP_Post;

/**
 * The decisions this plugin lets another plugin make.
 *
 * Every method here answers for itself, and that is the whole design. Each
 * one names a decision the plugin makes with a plain default — whether to
 * hide reported content before a human has looked at it, which asset bundle
 * the pages it renders should load, which capabilities this forum recognises,
 * what else is true of a comment, and what a member's upvote total comes to —
 * and hands it to a listener if there is one. With no listener the plugin's
 * own answer stands, and it is a complete, working behaviour.
 *
 * The filters are public. Any plugin may answer them, and nothing here knows
 * or asks which one does; a site that wanted its own moderation policy could
 * answer them itself.
 *
 * Callers ask this class rather than the filter directly, so the extension
 * points are enumerable in one file and a typo in a hook name is a missing
 * method rather than a behaviour that silently never turns on.
 *
 * Timing: none of these may be called before `plugins_loaded:12`, because a
 * listener registering at 11 has not been seen yet and the call would read as
 * "nobody answered".
 */
final class ExtensionPoints
{
    /**
     * The resolved bundle, which cannot change within a request.
     *
     * @var null|array{codeName: string, codeNameClient: string, uri: string}
     */
    private static ?array $assetBundle = null;

    /**
     * Where the admin and portal bundles are, and what their files are stamped
     * with.
     *
     * This plugin's own build, unless something answers with another. The
     * pages are still rendered here either way; only the files they load
     * change.
     *
     * The three travel together on purpose. Asked separately, a listener that
     * answers one and not another produces a URI from one build and a code
     * name from another, which names a file that does not exist; a listener
     * that cannot supply all three returns what it was given and the whole
     * working set falls back intact.
     *
     * Returning the array unchanged is a listener's normal way of declining,
     * so the shape is validated rather than trusted: anything missing a key or
     * answering with a non-string leaves this plugin's own bundle in place.
     *
     * Memoised because Head and BaseView each read all three while enqueuing,
     * and a filter that hits the filesystem should not run six times a page.
     * Called no earlier than `plugins_loaded:12`, like everything here — both
     * callers run on enqueue hooks, which is long after that.
     *
     * @return array{codeName: string, codeNameClient: string, uri: string}
     */
    public static function assetBundle(): array
    {
        if (self::$assetBundle !== null) {
            return self::$assetBundle;
        }

        $own = [
            'codeName'       => Config::readBuildCodeName(Config::ASSETS_FOLDER . '/build-code-name.txt'),
            'codeNameClient' => Config::readBuildCodeName(Config::ASSETS_FOLDER . '/client/build-code-name.txt'),
            'uri'            => Config::get('ROOT_URI') . '/' . Config::ASSETS_FOLDER,
        ];

        $offered = Hooks::applyFilter('bit_connect_asset_bundle', $own);

        foreach (array_keys($own) as $key) {
            if (!\is_array($offered) || !isset($offered[$key]) || !\is_string($offered[$key]) || $offered[$key] === '') {
                return self::$assetBundle = $own;
            }
        }

        return self::$assetBundle = [
            'codeName'       => $offered['codeName'],
            'codeNameClient' => $offered['codeNameClient'],
            'uri'            => $offered['uri'],
        ];
    }

    /**
     * Drops the memoised bundle.
     *
     * Only tests need it — they answer the filter differently per case and
     * would otherwise read the first case's answer for the whole run. Within a
     * request the bundle cannot change, so nothing in the plugin calls this.
     */
    public static function flush(): void
    {
        self::$assetBundle = null;
    }

    /**
     * The capability slugs this forum recognises.
     *
     * This plugin's own list, unless something adds to it. The role matrix is
     * built from this and, more importantly, applySettings() revokes anything
     * in it that a role was not granted — so a capability belonging to another
     * plugin has to be named here or saving the roles screen would strip it.
     *
     * A listener adds its own slugs and returns the list. Anything that is not
     * a non-empty string is dropped, and an answer that comes back empty or
     * malformed leaves this plugin's own list standing.
     *
     * @return list<string>
     */
    public static function capabilities(): array
    {
        $own = Capabilities::values();

        $offered = Hooks::applyFilter('bit_connect_capabilities', $own);

        if (!\is_array($offered)) {
            return $own;
        }

        $clean = array_values(
            array_unique(
                array_filter(
                    $offered,
                    static fn ($cap): bool => \is_string($cap) && $cap !== ''
                )
            )
        );

        return $clean === [] ? $own : $clean;
    }

    /**
     * The fields a formatted comment carries.
     *
     * Everything this plugin knows about a comment is in `$fields` already;
     * this is where a plugin that knows something more about the same comment
     * adds it. There is no key here for a listener to overwrite, and nothing
     * missing from a comment when nobody answers.
     *
     * Trusted no further than the shape: a listener that answers with
     * something that is not an array gets this plugin's own fields sent
     * instead of breaking the comment.
     *
     * @param array $fields    the comment as this plugin formats it
     * @param int   $commentId the comment being formatted
     */
    public static function commentFields(array $fields, int $commentId): array
    {
        $offered = Hooks::applyFilter('bit_connect_comment_fields', $fields, $commentId);

        return \is_array($offered) ? $offered : $fields;
    }

    /**
     * The fields a formatted topic carries.
     *
     * The topic counterpart of commentFields(): everything this plugin knows
     * about a topic is in `$fields` already, and this is where a plugin that
     * knows something more about the same topic adds it.
     *
     * Trusted no further than the shape: an answer that is not an array gets
     * this plugin's own fields sent instead of breaking the topic.
     *
     * @param array $fields the topic as this plugin formats it
     * @param int   $postId the topic being formatted
     */
    public static function topicFields(array $fields, int $postId): array
    {
        $offered = Hooks::applyFilter('bit_connect_topic_fields', $fields, $postId);

        return \is_array($offered) ? $offered : $fields;
    }

    /**
     * A thread ordered by something this plugin cannot order by.
     *
     * This plugin sorts a thread by date, either way round, and that is every
     * ordering it can perform: ordering by upvotes on replies needs upvotes on
     * replies, which it does not implement. Rather than silently treating an
     * ordering it does not know as "newest" — a sort control that does nothing
     * is the shape this plugin has been removing — it offers the question.
     *
     * A listener that recognises `$sort` returns the comments in that order. A
     * listener that does not returns null, and so does the absence of one, and
     * the caller falls back to its own date ordering.
     *
     * Trusted no further than the shape: an answer that is not a list of the
     * same comments is discarded rather than rendered, because a listener that
     * dropped or invented a reply would silently lose part of a thread.
     *
     * @param WP_Comment[] $comments the top-level comments, in date order
     * @param string       $sort     what was asked for
     *
     * @return null|array the ordered comments, or null to sort by date
     */
    public static function orderedComments(array $comments, string $sort): ?array
    {
        $offered = Hooks::applyFilter('bit_connect_ordered_comments', null, $comments, $sort);

        if (!\is_array($offered) || \count($offered) !== \count($comments)) {
            return null;
        }

        return $offered;
    }

    /**
     * The reply pinned to a topic, or 0 when none is.
     *
     * This plugin has no pin action anywhere — no route, no capability, no
     * menu entry. What it has is the reading half: a comment carries a
     * `pinned` flag and the thread puts a pinned reply first, both of which
     * are inert until something answers here with an id. Without a listener
     * that is never, so the flag is false on every comment and the ordering
     * is the ordering the reader asked for.
     *
     * Asked once per request and compared against each comment in turn, rather
     * than asked per comment: the listener reads post meta, and a filter call
     * for every reply on a three-hundred-reply topic would be three hundred
     * reads to answer one question.
     *
     * The listener is responsible for the id still being pinnable — a pinned
     * reply that has since been deleted, unapproved or hidden by a report must
     * come back as 0, or the portal would hoist a tombstone to the top of the
     * thread. This plugin cannot check that itself without knowing what the
     * listener stored, and does not try: whatever id comes back is matched
     * against comments already filtered for visibility, and a stale one
     * simply matches nothing.
     *
     * @param int $topicId the topic whose pin is being asked about
     */
    public static function pinnedCommentId(int $topicId): int
    {
        return (int) Hooks::applyFilter('bit_connect_pinned_comment', 0, $topicId);
    }

    /**
     * The events this forum can actually tell a member about.
     *
     * Every case this plugin raises by itself, which is all of them bar
     * BADGE_AWARDED — see NotificationTypes::isDispatchedHere() for why that
     * one is in the vocabulary but not in this plugin's dispatch. A plugin that
     * does raise it adds its slug back and the preference row returns with it.
     *
     * This governs which rows the admin defaults screen and the member's own
     * preference screen draw. It does not govern delivery: a notification of
     * any type, raised by anybody, is resolved and sent on its own merits, so a
     * type missing from this list is one nobody is being asked about rather
     * than one being withheld.
     *
     * Answered with slugs rather than cases, like capabilities(), so a listener
     * needs nothing of this plugin's but the string. Anything that is not a
     * slug this plugin knows is dropped — a listener cannot invent an event the
     * dispatcher has no vocabulary for — and an answer that comes back empty or
     * malformed leaves this plugin's own list standing.
     *
     * @return list<NotificationTypes>
     */
    public static function notifiableTypes(): array
    {
        $own = array_values(
            array_filter(
                NotificationTypes::cases(),
                static fn (NotificationTypes $type): bool => NotificationTypes::isDispatchedHere($type)
            )
        );

        $offered = Hooks::applyFilter(
            'bit_connect_notifiable_types',
            array_map(static fn (NotificationTypes $type): string => $type->value, $own)
        );

        if (!\is_array($offered)) {
            return $own;
        }

        $resolved = [];

        foreach ($offered as $slug) {
            $type = \is_string($slug) ? NotificationTypes::tryFrom($slug) : null;

            if ($type !== null && !\in_array($type, $resolved, true)) {
                $resolved[] = $type;
            }
        }

        return $resolved === [] ? $own : $resolved;
    }

    /**
     * Whether a member who does not moderate the forum still receives this
     * moderator-only type.
     *
     * This plugin's moderators are whoever holds the moderate capability, and
     * that alone decides who it sends moderator-only types to. A plugin with
     * moderators of its own — of one space, say — answers yes for them, for
     * the types they act on. Only ever widens: a forum moderator receives
     * every moderator-only type whatever a listener says.
     *
     * @param NotificationTypes $type   a moderator-only type
     * @param int               $userId a member who does not moderate the forum
     */
    public static function receivesModeratorType(NotificationTypes $type, int $userId): bool
    {
        return $userId > 0 && (bool) Hooks::applyFilter('bit_connect_receives_moderator_type', false, $type->value, $userId);
    }

    /**
     * How many upvotes a member has received.
     *
     * This plugin counts the votes on their topics, which is every vote it
     * knows how to cast. A plugin that counts something else a member can
     * receive adds it here. Nobody answering leaves the topic figure, which is
     * a true total of what this forum offers rather than a partial one.
     *
     * @param int $count  votes on this member's topics
     * @param int $userId the member
     */
    public static function votesReceived(int $count, int $userId): int
    {
        return (int) Hooks::applyFilter('bit_connect_votes_received', $count, $userId);
    }

    /**
     * Whether reported content is hidden automatically once enough members
     * have reported it.
     *
     * This plugin queues reports and shows them to moderators; it never acts on
     * them by itself, and answering no here is that policy rather than a
     * feature switched off. A listener decides otherwise if it wants to, and is
     * passed everything it needs: the target, its author (so staff can be
     * exempted — otherwise a member who disagrees with a moderator could bury
     * the answer by reporting it) and the pending count, which the caller has
     * usually already read.
     *
     * @param string   $targetType 'post' or 'comment'
     * @param int      $targetId   the reported post or comment
     * @param int      $author     who wrote it
     * @param null|int $pending    open reports against it, or null to let the listener count
     */
    public static function autoHideOnReports(string $targetType, int $targetId, int $author, ?int $pending = null): bool
    {
        return (bool) Hooks::applyFilter(
            'bit_connect_should_auto_hide',
            false,
            $targetType,
            $targetId,
            $author,
            $pending
        );
    }

    /**
     * How much a topic or a reply may hold — its length, its images and its
     * files — and how large one uploaded file may be.
     *
     * This plugin sets none — every value is null, "no limit" — so with
     * nobody listening a member may post as much as the server takes. A
     * listener answers with numbers of its own. The answer is raw:
     * PostingLimits validates its shape and caps the file size at what the
     * server accepts, so a listener cannot promise an upload PHP will refuse
     * anyway.
     *
     * @param array{topic: array{attachments: null, characters: null, images: null}, comment: array{attachments: null, characters: null, images: null}, maxFileSize: null} $own
     *
     * @return mixed
     */
    public static function postingLimits(array $own)
    {
        return Hooks::applyFilter('bit_connect_posting_limits', $own);
    }

    /**
     * Which files a member may attach to a topic or a reply: extension →
     * the MIME types its content may be read as.
     *
     * This plugin's answer is its own list of images and documents. A listener
     * may add to it or take from it. The answer is raw: AttachmentValidatorService
     * drops malformed entries and anything on its dangerous list, and every
     * upload is still checked against what WordPress itself allows and against
     * the file's actual bytes, so a listener widens the list, never the checks.
     *
     * Attachments only — avatars and cover images keep their own fixed list.
     *
     * @param array<string, string[]> $own
     *
     * @return mixed
     */
    public static function attachmentTypes(array $own)
    {
        return Hooks::applyFilter('bit_connect_attachment_types', $own);
    }

    /**
     * The topic list's query, for a named list this plugin does not define.
     *
     * The topic list is this plugin's filters and nothing else; it has no list
     * of its own under a name. A request that names one (`?view=…`) is offered
     * here, and a listener that recognises the name returns the query narrowed
     * to it. Nobody recognising it leaves the ordinary list, filters applied —
     * a stale link lands on the topics, not on an error.
     *
     * The listener answers for who may see what it lists: a list that names a
     * status this plugin keeps out of the listing must check the reader's
     * capability itself.
     *
     * Trusted no further than the shape: an answer that is not an array is
     * discarded and the ordinary query runs.
     *
     * @param array  $args the WP_Query arguments this plugin built
     * @param string $view the name asked for
     */
    public static function topicListQuery(array $args, string $view): array
    {
        $offered = Hooks::applyFilter('bit_connect_topic_list_query', $args, $view);

        return \is_array($offered) ? $offered : $args;
    }

    /**
     * Whether a topic this plugin would let someone read stays readable.
     *
     * This plugin decides from the topic's status and the reader alone; a
     * listener may hold a topic back for reasons of its own. It can only take
     * away: a topic the status rules refuse is never offered, so nothing a
     * listener answers makes a hidden or private topic readable.
     *
     * Asked about one topic at a time — the single-topic page, the write paths
     * and each notification recipient. The lists are narrowed separately, by
     * topicQueryArgs(), so the two must agree.
     *
     * Anything but `true` holds the topic back: a listener that answers with
     * the wrong type fails closed rather than open.
     *
     * @param WP_Post $post   the topic, already readable by this plugin's rules
     * @param int     $userId the reader, 0 for a visitor
     */
    public static function topicReadable(WP_Post $post, int $userId): bool
    {
        return Hooks::applyFilter('bit_connect_topic_readable', true, $post, $userId) === true;
    }

    /**
     * The query behind every topic list, offered before it runs.
     *
     * The listing, search, archives, profile lists and the sitemap all go
     * through here, so a listener that keeps some topics from a reader — the
     * same ones it refuses in topicReadable() — narrows every list at once,
     * typically with a `tax_query` clause or `post__not_in`.
     *
     * A listener adds to the query; it must not widen the statuses, which this
     * plugin chose for the reader. An answer that is not an array is discarded.
     *
     * @param array  $args    the WP_Query arguments this plugin built
     * @param int    $userId  the reader the list is for, 0 for a visitor
     * @param string $context `list` for the portal's own lists, `sitemap` for
     *                        what search engines are told about
     */
    public static function topicQueryArgs(array $args, int $userId, string $context): array
    {
        $offered = Hooks::applyFilter('bit_connect_topic_query_args', $args, $userId, $context);

        return \is_array($offered) ? $offered : $args;
    }

    /**
     * Portal paths this plugin does not route itself, which a plugin draws —
     * one segment each, e.g. `boards` for `/boards` — with the page's title.
     *
     * The portal serves its shell at each and the plugin's own client route
     * draws the page. A path this plugin already uses, or one that is not a
     * plain lower-case segment, is dropped: a plugin can add pages, never take
     * one over. Read per request, so a listener registered on
     * `plugins_loaded` is in time.
     *
     * @return array<string, string> path => page title
     */
    public static function portalPages(): array
    {
        $offered = Hooks::applyFilter('bit_connect_portal_pages', []);

        if (!\is_array($offered)) {
            return [];
        }

        $reserved = ['page', 'user', 'notifications', 'following', 'roadmap', 'login', 'register', 'verify-email', 'forgot-password', 'comment'];
        $pages = [];

        foreach ($offered as $path => $title) {
            $path = \is_string($path) ? $path : '';

            if (!preg_match('/^[a-z0-9][a-z0-9-]{0,39}$/', $path) || \in_array($path, $reserved, true) || PortalTaxonomies::isReservedSegment($path)) {
                continue;
            }

            $pages[$path] = sanitize_text_field(\is_string($title) ? $title : '') ?: $path;
        }

        return $pages;
    }

    /**
     * Published topics a plugin keeps from this reader, by id — for the queries
     * this plugin writes as SQL (profile lists, counts, insights), which no
     * WP_Query argument reaches. The same topics topicReadable() refuses.
     *
     * Only ids are honoured: anything else in the answer is dropped.
     *
     * @param int $userId the reader, 0 for a visitor
     *
     * @return array<int, int>
     */
    public static function heldBackTopicIds(int $userId): array
    {
        $offered = Hooks::applyFilter('bit_connect_held_back_topic_ids', [], $userId);

        if (!\is_array($offered)) {
            return [];
        }

        return array_values(array_unique(array_filter(array_map('intval', $offered), static fn (int $id): bool => $id > 0)));
    }

    /**
     * The terms of a taxonomy the portal lists to its reader.
     *
     * Every term, unless a listener keeps some from this reader — a term that
     * stands for something they may not see. Only removal is honoured: an
     * answer that adds terms, or is not an array, leaves the list as it was.
     *
     * @param array<int, mixed> $terms    the terms this plugin would list
     * @param string            $taxonomy their taxonomy
     *
     * @return array<int, mixed>
     */
    public static function portalTerms(array $terms, string $taxonomy): array
    {
        $offered = Hooks::applyFilter('bit_connect_portal_terms', $terms, $taxonomy);

        if (!\is_array($offered) || \count($offered) > \count($terms)) {
            return $terms;
        }

        return array_values($offered);
    }
}
