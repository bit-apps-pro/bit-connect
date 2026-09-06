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

/**
 * Public profile data for a portal member.
 *
 * Everything returned here is readable by any visitor, so the shape is built by
 * allow-list rather than by handing back WP objects: a WP_User carries the
 * email, login and role, and the stock comment row carries the author's email,
 * IP and user agent. None of that belongs on a public page, so nothing here
 * copies a record wholesale.
 *
 * Visibility of the *content* is delegated rather than reimplemented — topics go
 * through TopicService (WP_Query with `perm => readable`), and comments are
 * restricted to approved rows on readable topics.
 */
class UserProfileService
{
    /**
     * Page size cap, so a crafted per_page cannot ask for the whole table.
     */
    private const MAX_PER_PAGE = 50;

    /**
     * Section each capability is listed under on the profile. Keeps the panel
     * readable as the enum grows rather than showing one flat list of twelve.
     */
    private const CAPABILITY_GROUPS = [
        'forum_create_post'        => 'Posting',
        'forum_edit_own_post'      => 'Posting',
        'forum_delete_own_post'    => 'Posting',
        'forum_create_comment'     => 'Commenting',
        'forum_edit_own_comment'   => 'Commenting',
        'forum_delete_own_comment' => 'Commenting',
        'forum_vote_post'          => 'Voting',
        'forum_vote_comment'       => 'Voting',
        'forum_delete_any'         => 'Other People\'s Content',
        'forum_moderate'           => 'Moderation',
        'forum_pin_post'           => 'Moderation',
        'forum_lock_post'          => 'Moderation',
        'forum_manage'             => 'Administration',
    ];

    private TopicService $topicService;

    public function __construct()
    {
        $this->topicService = new TopicService();
    }

    /**
     * Public identity for a member, or null when no such user exists.
     *
     * Deliberately omits email, user_login and roles: display name and avatar
     * are already visible on every topic and comment they have written, and
     * nothing more is needed to render a profile.
     *
     * @param int $userId
     *
     * @return null|array{
     *     id:int, slug:string, display_name:string,
     *     avatar:string, has_custom_avatar:bool,
     *     cover:null|string, has_custom_cover:bool,
     *     bio:string, social_links:array<string, string>,
     *     registered_at:string, last_active_at:null|string, role_label:string
     * }
     */
    public function profile($userId)
    {
        $userId = self::resolveId($userId);
        $user = get_userdata($userId);

        // Ternary rather than an early `return null;`: cs-fixer rewrites that
        // to a bare `return;`, which then fails the declared nullable array
        // return type under PHPStan.
        return $user ? [
            'id'                => $userId,
            'slug'              => ProfileSlugService::slugFor($userId),
            'display_name'      => $user->display_name,
            'avatar'            => get_avatar_url($userId, ['size' => 200]),
            'has_custom_avatar' => AvatarService::avatarId($userId) > 0,
            'cover'             => CoverImageService::coverUrl($userId),
            'has_custom_cover'  => CoverImageService::coverId($userId) > 0,
            // Member-authored, and public by design — the bio and links exist to
            // be read by whoever lands on the profile.
            'bio'            => MemberProfileService::bio($userId),
            'social_links'   => MemberProfileService::links($userId),
            'registered_at'  => $user->user_registered,
            'last_active_at' => $this->lastActiveAt($userId),
            'role_label'     => $this->roleLabel($userId),
            // The same standing as an object, so the card can colour it by tone
            // instead of matching on the printed word — a site that renames its
            // moderators through the badge filter would fall through a
            // label-keyed style map. Null for members with no standing.
            'badge' => UserBadgeService::for($userId),
            // The profile card has room for the whole set where a byline does
            // not, and a member handed Developer and Support should see both on
            // the page that is about them. `badge` stays as the first of these
            // so nothing reading it has to change.
            'badges' => UserBadgeService::all($userId),
        ] : null;
    }

    /**
     * Accept either a profile slug or a numeric id.
     *
     * Profile URLs address members by slug, but the remaining endpoints and
     * every internal caller work in ids — this is the one place the two meet.
     *
     * @param int|string $identifier
     *
     * @return int 0 when it matches no member
     */
    public static function resolveId($identifier)
    {
        if (is_numeric($identifier)) {
            return (int) $identifier;
        }

        return ProfileSlugService::resolve((string) $identifier);
    }

    /**
     * What a member is allowed to do, as label/allowed pairs.
     *
     * Read through current_user_can-equivalent checks against the target user
     * so per-user overrides are reflected, not just the role defaults.
     *
     * @param int $userId
     *
     * @return array<int, array{key:string, label:string, group:string, allowed:bool}>
     */
    public function permissions($userId)
    {
        $user = get_userdata((int) $userId);

        if (!$user) {
            return [];
        }

        $permissions = [];

        foreach (Capabilities::cases() as $capability) {
            // Pinning is not part of the current release, so the panel should
            // not promise it either way.
            if ($capability === Capabilities::PIN_POST) {
                continue;
            }

            $permissions[] = [
                'key' => $capability->value,
                // phpcs:ignore WordPress.WP.I18n.NonSingularStringLiteralText -- labels are English literals defined in #[Label] attributes; translated here at the read site
                'label' => __($capability->label(), 'bit-connect'),
                'group' => self::CAPABILITY_GROUPS[$capability->value] ?? 'Other',
                // user_can() rather than current_user_can(): the answer is about
                // the profile's owner, who may not be the person asking.
                'allowed' => user_can($user, $capability->value),
            ];
        }

        return $permissions;
    }

    /**
     * Topics authored by the member, newest first.
     *
     * @param int $userId
     * @param int $page
     * @param int $perPage
     *
     * @return array{data:array, pagination:array}
     */
    public function topics($userId, $page = 1, $perPage = 10)
    {
        [$page, $perPage] = $this->paging($page, $perPage);

        $topics = $this->topicService->getAllTopics(
            [
                'author'           => (int) $userId,
                'numberposts'      => $perPage,
                'paged'            => $page,
                'orderby'          => 'date',
                'order'            => 'DESC',
                'include_comments' => false,
            ]
        );

        return [
            'data'       => $topics,
            'pagination' => $this->pagination($this->topicService->getLastQueryTotal(), $page, $perPage),
        ];
    }

    /**
     * Everything the member has posted, topics and comments interleaved by date.
     *
     * The ordering has to happen across both tables at once, so pagination runs
     * on a UNION of (id, kind, date) and only the resulting page is hydrated —
     * fetching all topics and all comments and merging in PHP would read the
     * member's entire history to render ten rows.
     *
     * @param int $userId
     * @param int $page
     * @param int $perPage
     *
     * @return array{data:array, pagination:array}
     */
    public function overview($userId, $page = 1, $perPage = 10)
    {
        $wpdbComments = Connection::prop('comments');
        $wpdbPosts = Connection::prop('posts');

        [$page, $perPage] = $this->paging($page, $perPage);
        $userId = (int) $userId;
        $postType = PostTypes::BIT_CONNECT->value;

        $topicWhere = Connection::prepare(
            "p.post_author = %d AND p.post_type = %s AND p.post_status = 'publish'",
            $userId,
            $postType
        );

        $commentWhere = Connection::prepare(
            "c.user_id = %d AND c.comment_approved = '1' AND c.comment_type IN ('', 'comment')
             AND cp.post_type = %s AND cp.post_status = 'publish'",
            $userId,
            $postType
        );

        $union = "SELECT 'topic' AS kind, p.ID AS item_id, p.post_date_gmt AS occurred_at
                  FROM {$wpdbPosts} p
                  WHERE {$topicWhere}
                  UNION ALL
                  SELECT 'comment' AS kind, c.comment_ID AS item_id, c.comment_date_gmt AS occurred_at
                  FROM {$wpdbComments} c
                  INNER JOIN {$wpdbPosts} cp ON cp.ID = c.comment_post_ID
                  WHERE {$commentWhere}";

        $total = (int) Connection::get_var("SELECT COUNT(*) FROM ({$union}) AS feed");

        $rows = Connection::get_results(
            Connection::prepare(
                "SELECT * FROM ({$union}) AS feed ORDER BY feed.occurred_at DESC LIMIT %d OFFSET %d",
                $perPage,
                ($page - 1) * $perPage
            )
        );

        return [
            'data'       => $this->hydrateFeed($rows),
            'pagination' => $this->pagination($total, $page, $perPage),
        ];
    }

    /**
     * The member's topics that are currently pinned.
     *
     * Pinning is WordPress's `sticky_posts` option, which TopicService already
     * reads back as `is_pinned`. There is no index on it, so this filters an
     * explicit id list rather than querying — the sticky set is small by
     * definition (it is a curated shortlist, not a category).
     *
     * @param int $userId
     * @param int $page
     * @param int $perPage
     *
     * @return array{data:array, pagination:array}
     */
    public function pinnedTopics($userId, $page = 1, $perPage = 10)
    {
        [$page, $perPage] = $this->paging($page, $perPage);

        $sticky = array_map('intval', (array) get_option('sticky_posts', []));

        if ($sticky === []) {
            return [
                'data'       => [],
                'pagination' => $this->pagination(0, $page, $perPage),
            ];
        }

        // Restrict to this member's own sticky topics; getAllTopics still
        // applies the status and `perm => readable` rules.
        $owned = $this->topicService->getAllTopics(
            [
                'author'           => (int) $userId,
                'post__in'         => $sticky,
                'numberposts'      => -1,
                'include_comments' => false,
            ]
        );

        $total = \count($owned);
        $offset = ($page - 1) * $perPage;

        return [
            'data'       => \array_slice($owned, $offset, $perPage),
            'pagination' => $this->pagination($total, $page, $perPage),
        ];
    }

    /**
     * Approved comments the member left on portal topics, newest first.
     *
     * Each row carries just enough context to render a list entry and link back
     * to the topic it belongs to.
     *
     * @param int $userId
     * @param int $page
     * @param int $perPage
     *
     * @return array{data:array, pagination:array}
     */
    public function comments($userId, $page = 1, $perPage = 10)
    {
        $wpdbComments = Connection::prop('comments');
        $wpdbPosts = Connection::prop('posts');

        [$page, $perPage] = $this->paging($page, $perPage);
        $userId = (int) $userId;
        $offset = ($page - 1) * $perPage;

        $where = Connection::prepare(
            "c.user_id = %d
             AND c.comment_approved = '1'
             AND c.comment_type IN ('', 'comment')
             AND p.post_type = %s
             AND p.post_status = 'publish'",
            $userId,
            PostTypes::BIT_CONNECT->value
        );

        $total = (int) Connection::get_var(
            "SELECT COUNT(*) FROM {$wpdbComments} c
             INNER JOIN {$wpdbPosts} p ON p.ID = c.comment_post_ID
             WHERE {$where}"
        );

        $rows = Connection::get_results(
            Connection::prepare(
                "SELECT c.comment_ID, c.comment_post_ID, c.comment_content, c.comment_date_gmt,
                        p.post_title, p.post_name
                 FROM {$wpdbComments} c
                 INNER JOIN {$wpdbPosts} p ON p.ID = c.comment_post_ID
                 WHERE {$where}
                 ORDER BY c.comment_date_gmt DESC
                 LIMIT %d OFFSET %d",
                $perPage,
                $offset
            )
        );

        $comments = [];
        foreach ($rows as $row) {
            $comments[] = [
                'comment_ID'       => (int) $row->comment_ID,
                'comment_post_ID'  => (int) $row->comment_post_ID,
                'comment_content'  => $row->comment_content,
                'comment_date_gmt' => $row->comment_date_gmt,
                'post_title'       => $row->post_title,
                'post_name'        => $row->post_name,
                'vote'             => TopicService::getCommentVoteStatus((int) $row->comment_ID),
            ];
        }

        return [
            'data'       => $comments,
            'pagination' => $this->pagination($total, $page, $perPage),
        ];
    }

    /**
     * Topics the member has upvoted, newest vote first.
     *
     * Only ever served to the member themselves — see GetUserVotesRequest. A
     * public voting history would expose an opinion the voter never published,
     * which is why no major forum shows one to third parties.
     *
     * @param int $userId
     * @param int $page
     * @param int $perPage
     *
     * @return array{data:array, pagination:array}
     */
    public function votedTopics($userId, $page = 1, $perPage = 10)
    {
        $wpdbPosts = Connection::prop('posts');
        $wpdbPrefix = Connection::prop('prefix');

        [$page, $perPage] = $this->paging($page, $perPage);
        $userId = (int) $userId;
        $votes = $wpdbPrefix . Config::VAR_PREFIX . 'votes';

        $where = Connection::prepare(
            "v.user_id = %d
             AND v.post_id IS NOT NULL
             AND p.post_type = %s
             AND p.post_status = 'publish'",
            $userId,
            PostTypes::BIT_CONNECT->value
        );

        $total = (int) Connection::get_var(
            "SELECT COUNT(*) FROM {$votes} v
             INNER JOIN {$wpdbPosts} p ON p.ID = v.post_id
             WHERE {$where}"
        );

        $ids = Connection::get_col(
            Connection::prepare(
                "SELECT v.post_id FROM {$votes} v
                 INNER JOIN {$wpdbPosts} p ON p.ID = v.post_id
                 WHERE {$where}
                 ORDER BY v.id DESC
                 LIMIT %d OFFSET %d",
                $perPage,
                ($page - 1) * $perPage
            )
        );

        // Paging happens over the votes table above, so this hydrates exactly
        // the page's IDs. -1 posts_per_page because the set is already bounded.
        $topics = $ids
            ? $this->topicService->getAllTopics(
                [
                    'post__in'         => $ids,
                    'numberposts'      => -1,
                    'include_comments' => false,
                ]
            )
            : [];

        return [
            'data'       => $topics,
            'pagination' => $this->pagination($total, $page, $perPage),
        ];
    }

    /**
     * When the member last posted or commented, or null if they never have.
     *
     * Derived from their content rather than a login timestamp: WordPress does
     * not record last-login, and "last seen contributing" is the more useful
     * signal on a forum profile anyway.
     *
     * @param int $userId
     *
     * @return null|string
     */
    private function lastActiveAt($userId)
    {
        $wpdbComments = Connection::prop('comments');
        $wpdbPosts = Connection::prop('posts');

        $lastPost = Connection::get_var(
            Connection::prepare(
                "SELECT MAX(post_date_gmt) FROM {$wpdbPosts}
                 WHERE post_author = %d AND post_type = %s AND post_status = 'publish'",
                $userId,
                PostTypes::BIT_CONNECT->value
            )
        );

        $lastComment = Connection::get_var(
            Connection::prepare(
                "SELECT MAX(c.comment_date_gmt) FROM {$wpdbComments} c
                 INNER JOIN {$wpdbPosts} p ON p.ID = c.comment_post_ID
                 WHERE c.user_id = %d AND c.comment_approved = '1' AND p.post_type = %s",
                $userId,
                PostTypes::BIT_CONNECT->value
            )
        );

        $latest = max((string) $lastPost, (string) $lastComment);

        return $latest === '' ? null : $latest;
    }

    /**
     * Coarse standing shown as a badge — not the raw WordPress role, which is
     * an implementation detail visitors have no use for.
     *
     * Delegates to UserBadgeService so this page and the bylines on topics and
     * comments answer from one ladder. 'Member' stays the fallback here because
     * the profile card always prints a standing, where a byline prints nothing.
     *
     * @param int $userId
     *
     * @return string
     */
    private function roleLabel($userId)
    {
        return UserBadgeService::label((int) $userId);
    }

    /**
     * Turn a page of (kind, id) rows into full topic and comment records.
     *
     * Each kind is fetched in one batch rather than per row, then re-emitted in
     * the union's order so the interleaving survives.
     *
     * @param array $rows
     *
     * @return array<int, array>
     */
    private function hydrateFeed($rows)
    {
        $topicIds = [];
        $commentIds = [];

        foreach ($rows as $row) {
            if ($row->kind === 'topic') {
                $topicIds[] = (int) $row->item_id;
            } else {
                $commentIds[] = (int) $row->item_id;
            }
        }

        $topics = [];
        if ($topicIds !== []) {
            // Through getAllTopics so the status and `perm => readable` rules
            // still apply — an unreadable topic drops out rather than leaking.
            foreach (
                $this->topicService->getAllTopics(
                    ['post__in' => $topicIds, 'numberposts' => -1, 'include_comments' => false]
                ) as $topic
            ) {
                $topics[(int) $topic['ID']] = $topic;
            }
        }

        $comments = $commentIds === [] ? [] : $this->commentsByIds($commentIds);

        $feed = [];
        foreach ($rows as $row) {
            $id = (int) $row->item_id;

            if ($row->kind === 'topic' && isset($topics[$id])) {
                $feed[] = ['kind' => 'topic', 'occurred_at' => $row->occurred_at, 'topic' => $topics[$id]];
            } elseif ($row->kind === 'comment' && isset($comments[$id])) {
                $feed[] = ['kind' => 'comment', 'occurred_at' => $row->occurred_at, 'comment' => $comments[$id]];
            }
        }

        return $feed;
    }

    /**
     * Public-safe comment records for the given ids, keyed by comment id.
     *
     * Same allow-list as comments(): no author email, IP or user agent.
     *
     * @param array<int, int> $commentIds
     *
     * @return array<int, array>
     */
    private function commentsByIds($commentIds)
    {
        $wpdbComments = Connection::prop('comments');
        $wpdbPosts = Connection::prop('posts');

        $placeholders = implode(',', array_fill(0, \count($commentIds), '%d'));

        $rows = Connection::get_results(
            Connection::prepare(
                "SELECT c.comment_ID, c.comment_post_ID, c.comment_content, c.comment_date_gmt,
                        p.post_title, p.post_name
                 FROM {$wpdbComments} c
                 INNER JOIN {$wpdbPosts} p ON p.ID = c.comment_post_ID
                 WHERE c.comment_ID IN ({$placeholders})",
                ...$commentIds
            )
        );

        $comments = [];
        foreach ($rows as $row) {
            $comments[(int) $row->comment_ID] = [
                'comment_ID'       => (int) $row->comment_ID,
                'comment_post_ID'  => (int) $row->comment_post_ID,
                'comment_content'  => $row->comment_content,
                'comment_date_gmt' => $row->comment_date_gmt,
                'post_title'       => $row->post_title,
                'post_name'        => $row->post_name,
                'vote'             => TopicService::getCommentVoteStatus((int) $row->comment_ID),
            ];
        }

        return $comments;
    }

    /**
     * Clamp incoming paging values.
     *
     * @param int $page
     * @param int $perPage
     *
     * @return array{0:int, 1:int}
     */
    private function paging($page, $perPage)
    {
        return [
            max(1, (int) $page),
            min(self::MAX_PER_PAGE, max(1, (int) $perPage)),
        ];
    }

    /**
     * Pagination envelope matching the shape the topics endpoint returns.
     *
     * @param int $total
     * @param int $page
     * @param int $perPage
     *
     * @return array{total:int, per_page:int, current_page:int, total_pages:int}
     */
    private function pagination($total, $page, $perPage)
    {
        return [
            'total'        => $total,
            'per_page'     => $perPage,
            'current_page' => $page,
            'total_pages'  => $perPage > 0 ? (int) ceil($total / $perPage) : 1,
        ];
    }
}
