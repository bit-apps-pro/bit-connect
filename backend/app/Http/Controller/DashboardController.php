<?php

namespace BitApps\BitConnect\Http\Controller;

// Prevent direct script access
if (!defined('ABSPATH')) {
    exit;
}

use BitApps\BitConnect\Config;
use BitApps\BitConnect\Deps\BitApps\WPDatabase\Connection;
use BitApps\BitConnect\Deps\BitApps\WPKit\Http\Response;
use BitApps\BitConnect\Enum\PostTypes;
use BitApps\BitConnect\Enum\ReportStatus;
use BitApps\BitConnect\Enum\Taxonomies;
use BitApps\BitConnect\Http\Requests\GetDashboardRequest;
use BitApps\BitConnect\Services\PortalLocation;
use BitApps\BitConnect\Services\SiteCalendar;
use BitApps\BitConnect\Services\StageService;
use BitApps\BitConnect\Services\TermOrderService;
use BitApps\BitConnect\Services\UserBadgeService;
use WP_Term;

/**
 * The admin dashboard: totals, what changed over a period, and what to look at.
 *
 * Every timestamp compared or returned here is GMT — `post_date_gmt`,
 * `comment_date_gmt`, `user_registered` and the plugin's own tables all store
 * it. The periods themselves are the site's days and months (SiteCalendar), so
 * "today" on the chart turns over at the site's midnight, not London's.
 */
final class DashboardController
{
    private const DEFAULT_PERIOD = '30d';

    private const MOST_REQUESTED_LIMIT = 5;

    private const RECENT_TOPICS_LIMIT = 6;

    private const TOP_CONTRIBUTORS_LIMIT = 5;

    public function get(GetDashboardRequest $request)
    {
        $period = \is_string($request->period) && $request->period !== '' ? $request->period : self::DEFAULT_PERIOD;
        $since = $this->periodStart($period);

        $postType = PostTypes::BIT_CONNECT->value;
        $votesTable = Connection::prop('prefix') . Config::VAR_PREFIX . 'votes';

        $mostRequested = $this->getMostRequested($postType, $votesTable, $since);
        $recentTopics = $this->getRecentTopics($postType, $votesTable);

        $stages = $this->stagesFor(
            array_merge(
                array_column($mostRequested, 'id'),
                array_column($recentTopics, 'id')
            )
        );

        return Response::success(
            [
                'period'        => $period,
                'portalUrl'     => PortalLocation::url(),
                'stats'         => $this->getStats($postType, $votesTable, $since),
                'topicTypes'    => $this->getTopicTypeNames(),
                'attention'     => $this->getAttention($postType),
                'activity'      => $this->getActivity($postType, $period, $since),
                'stages'        => $this->getStageProgress($postType, $since),
                'mostRequested' => $this->withStage($mostRequested, $stages),
                'recentTopics'  => $this->withStage($recentTopics, $stages),
                'contributors'  => $this->getTopContributors($postType, $votesTable, $since),
            ]
        );
    }

    /**
     * The GMT instant a period starts at: the site's midnight at the start of its
     * first day, or of its first month for the twelve-month view, so the chart's
     * first bar is a whole bucket rather than a sliver.
     */
    private function periodStart(string $period): string
    {
        return SiteCalendar::periodStart($period);
    }

    private function getStats(string $postType, string $votesTable, string $since): array
    {
        $wpdbComments = Connection::prop('comments');
        $wpdbPosts = Connection::prop('posts');
        $wpdbUsers = Connection::prop('users');

        // phpcs:disable WordPress.DB.DirectDatabaseQuery
        $topics = Connection::get_row(
            Connection::prepare(
                "SELECT COUNT(*) AS total,
                        SUM(post_date_gmt >= %s) AS added,
                        SUM(comment_count > 0) AS commented
                 FROM {$wpdbPosts}
                 WHERE post_type = %s AND post_status = 'publish'",
                $since,
                $postType
            )
        );

        $comments = Connection::get_row(
            Connection::prepare(
                "SELECT COUNT(*) AS total, SUM(c.comment_date_gmt >= %s) AS added
                 FROM {$wpdbComments} c
                 INNER JOIN {$wpdbPosts} p ON c.comment_post_ID = p.ID
                 WHERE c.comment_approved = '1'
                   AND p.post_type = %s
                   AND p.post_status = 'publish'",
                $since,
                $postType
            )
        );

        $members = Connection::get_row(
            Connection::prepare(
                "SELECT COUNT(*) AS total, SUM(user_registered >= %s) AS added FROM {$wpdbUsers}",
                $since
            )
        );

        // A member's first contribution — topic or reply — landing inside the
        // period. Registration alone says nothing about taking part.
        $firstTimePosters = (int) Connection::get_var(
            Connection::prepare(
                "SELECT COUNT(*) FROM (
                    SELECT author, MIN(at) AS first_at FROM (
                        SELECT post_author AS author, post_date_gmt AS at
                        FROM {$wpdbPosts}
                        WHERE post_type = %s AND post_status = 'publish' AND post_author > 0
                        UNION ALL
                        SELECT c.user_id AS author, c.comment_date_gmt AS at
                        FROM {$wpdbComments} c
                        INNER JOIN {$wpdbPosts} p ON c.comment_post_ID = p.ID
                        WHERE c.comment_approved = '1' AND c.user_id > 0
                          AND p.post_type = %s AND p.post_status = 'publish'
                    ) contributions
                    GROUP BY author
                    HAVING first_at >= %s
                ) first_timers",
                $postType,
                $postType,
                $since
            )
        );

        $votes = Connection::get_row(
            Connection::prepare(
                "SELECT COUNT(*) AS total, SUM(created_at >= %s) AS added FROM `{$votesTable}`",
                $since
            )
        );
        // phpcs:enable WordPress.DB.DirectDatabaseQuery

        return [
            'totalTopics'      => (int) ($topics->total ?? 0),
            'newTopics'        => (int) ($topics->added ?? 0),
            'commentedTopics'  => (int) ($topics->commented ?? 0),
            'totalComments'    => (int) ($comments->total ?? 0),
            'newComments'      => (int) ($comments->added ?? 0),
            'totalMembers'     => (int) ($members->total ?? 0),
            'newMembers'       => (int) ($members->added ?? 0),
            'firstTimePosters' => $firstTimePosters,
            'totalVotes'       => (int) ($votes->total ?? 0),
            'newVotes'         => (int) ($votes->added ?? 0),
            'topVotedStage'    => $this->getTopVotedStage($postType, $votesTable),
        ];
    }

    /**
     * The stage whose topics hold the most votes, for the Votes card's footnote.
     */
    private function getTopVotedStage(string $postType, string $votesTable): ?string
    {
        $wpdbPosts = Connection::prop('posts');
        $wpdbRelationships = Connection::prop('term_relationships');
        $wpdbTaxonomy = Connection::prop('term_taxonomy');

        // phpcs:ignore WordPress.DB.DirectDatabaseQuery
        $termId = (int) Connection::get_var(
            Connection::prepare(
                "SELECT tt.term_id
                 FROM `{$votesTable}` v
                 INNER JOIN {$wpdbPosts} p ON p.ID = v.post_id
                 INNER JOIN {$wpdbRelationships} tr ON tr.object_id = p.ID
                 INNER JOIN {$wpdbTaxonomy} tt ON tt.term_taxonomy_id = tr.term_taxonomy_id
                 WHERE tt.taxonomy = %s AND p.post_type = %s AND p.post_status = 'publish'
                 GROUP BY tt.term_id
                 ORDER BY COUNT(*) DESC
                 LIMIT 1",
                Taxonomies::STAGES->value,
                $postType
            )
        );

        $term = $termId > 0 ? get_term($termId) : null;

        return $term instanceof WP_Term ? wp_specialchars_decode($term->name, ENT_QUOTES) : null;
    }

    /**
     * Topic type names in the admin's order, for the Posts card's footnote.
     *
     * @return string[]
     */
    private function getTopicTypeNames(): array
    {
        return array_map(
            static fn ($term) => wp_specialchars_decode($term->name, ENT_QUOTES),
            TermOrderService::ordered(Taxonomies::TOPIC_TYPES->value)
        );
    }

    /**
     * What is waiting on someone: topics nobody has answered, reported items
     * awaiting a decision, and replies held for approval.
     */
    private function getAttention(string $postType): array
    {
        $wpdbComments = Connection::prop('comments');
        $wpdbPosts = Connection::prop('posts');
        $reportsTable = Connection::prop('prefix') . Config::VAR_PREFIX . 'reports';

        // phpcs:disable WordPress.DB.DirectDatabaseQuery
        $unanswered = (int) Connection::get_var(
            Connection::prepare(
                "SELECT COUNT(*) FROM {$wpdbPosts}
                 WHERE post_type = %s AND post_status = 'publish' AND comment_count = 0",
                $postType
            )
        );

        // Counted by reported item, as the Reports screen counts them: five
        // people reporting one reply is one decision.
        $reports = (int) Connection::get_var(
            Connection::prepare(
                "SELECT COUNT(DISTINCT target_type, target_id) FROM `{$reportsTable}` WHERE status = %s",
                ReportStatus::PENDING->value
            )
        );

        $pendingReplies = (int) Connection::get_var(
            Connection::prepare(
                "SELECT COUNT(*) FROM {$wpdbComments} c
                 INNER JOIN {$wpdbPosts} p ON c.comment_post_ID = p.ID
                 WHERE c.comment_approved = '0' AND p.post_type = %s",
                $postType
            )
        );
        // phpcs:enable WordPress.DB.DirectDatabaseQuery

        return [
            'unanswered'     => $unanswered,
            'reports'        => $reports,
            'pendingReplies' => $pendingReplies,
        ];
    }

    /**
     * Topics and replies per bucket: a day for the 7- and 30-day views, a month
     * for the twelve-month one. Empty buckets are kept so the chart's axis is
     * the whole period, not just the days something happened.
     */
    private function getActivity(string $postType, string $period, string $since): array
    {
        $wpdbComments = Connection::prop('comments');
        $wpdbPosts = Connection::prop('posts');

        $isMonthly = $period === '12m';
        $starts = SiteCalendar::bucketStarts($period);

        // A row's bucket is the last site-local boundary at or before it. Each
        // boundary is a site midnight converted to GMT, so the grouping follows
        // the site's calendar — DATE_FORMAT on the GMT column would file a
        // 02:00 Dhaka topic under the previous day.
        $boundaries = array_map([SiteCalendar::class, 'toGmt'], \array_slice($starts, 1));
        $bucketOf = static function (string $column) use ($boundaries): string {
            $when = '';

            foreach (array_keys($boundaries) as $i) {
                $when .= " WHEN {$column} < %s THEN {$i}";
            }

            return "CASE{$when} ELSE " . \count($boundaries) . ' END';
        };

        // phpcs:disable WordPress.DB.DirectDatabaseQuery
        $topicRows = Connection::get_results(
            Connection::prepare(
                'SELECT ' . $bucketOf('post_date_gmt') . " AS bucket, COUNT(*) AS total
                 FROM {$wpdbPosts}
                 WHERE post_type = %s AND post_status = 'publish' AND post_date_gmt >= %s
                 GROUP BY bucket",
                ...[...$boundaries, $postType, $since]
            )
        );

        $commentRows = Connection::get_results(
            Connection::prepare(
                'SELECT ' . $bucketOf('c.comment_date_gmt') . " AS bucket, COUNT(*) AS total
                 FROM {$wpdbComments} c
                 INNER JOIN {$wpdbPosts} p ON c.comment_post_ID = p.ID
                 WHERE p.post_type = %s
                   AND p.post_status = 'publish'
                   AND c.comment_approved = '1'
                   AND c.comment_date_gmt >= %s
                 GROUP BY bucket",
                ...[...$boundaries, $postType, $since]
            )
        );
        // phpcs:enable WordPress.DB.DirectDatabaseQuery

        $buckets = [];

        foreach ($starts as $start) {
            // The bucket's own site-local date, left for the browser to label in
            // the reader's language — a month name formatted here would be English.
            $buckets[] = [
                'date'     => $start->format($isMonthly ? 'Y-m-01' : 'Y-m-d'),
                'topics'   => 0,
                'comments' => 0,
            ];
        }

        foreach ($topicRows as $row) {
            if (isset($buckets[(int) $row->bucket])) {
                $buckets[(int) $row->bucket]['topics'] = (int) $row->total;
            }
        }

        foreach ($commentRows as $row) {
            if (isset($buckets[(int) $row->bucket])) {
                $buckets[(int) $row->bucket]['comments'] = (int) $row->total;
            }
        }

        return $buckets;
    }

    /**
     * Every stage in the admin's order with how many topics sit in it, and how
     * many of those arrived during the period.
     */
    private function getStageProgress(string $postType, string $since): array
    {
        $wpdbPosts = Connection::prop('posts');
        $wpdbRelationships = Connection::prop('term_relationships');
        $wpdbTaxonomy = Connection::prop('term_taxonomy');

        // phpcs:ignore WordPress.DB.DirectDatabaseQuery
        $rows = Connection::get_results(
            Connection::prepare(
                "SELECT tt.term_id, COUNT(*) AS total, SUM(p.post_date_gmt >= %s) AS added
                 FROM {$wpdbRelationships} tr
                 INNER JOIN {$wpdbTaxonomy} tt ON tt.term_taxonomy_id = tr.term_taxonomy_id
                 INNER JOIN {$wpdbPosts} p ON p.ID = tr.object_id
                 WHERE tt.taxonomy = %s AND p.post_type = %s AND p.post_status = 'publish'
                 GROUP BY tt.term_id",
                $since,
                Taxonomies::STAGES->value,
                $postType
            )
        );

        $counts = [];
        foreach ($rows as $row) {
            $counts[(int) $row->term_id] = $row;
        }

        return array_map(
            function ($term) use ($counts) {
                $row = $counts[$term->term_id] ?? null;

                return [
                    'id'    => $term->term_id,
                    'name'  => wp_specialchars_decode($term->name, ENT_QUOTES),
                    'color' => $this->stageColor($term->term_id),
                    'count' => (int) ($row->total ?? 0),
                    'added' => (int) ($row->added ?? 0),
                ];
            },
            StageService::ordered()
        );
    }

    private function getMostRequested(string $postType, string $votesTable, string $since): array
    {
        $wpdbPosts = Connection::prop('posts');

        // phpcs:disable WordPress.DB.DirectDatabaseQuery
        $rows = Connection::get_results(
            Connection::prepare(
                "SELECT p.ID AS id,
                        p.post_title AS title,
                        p.comment_count AS replies,
                        COUNT(v.id) AS votes,
                        COALESCE(SUM(v.created_at >= %s), 0) AS recent_votes
                 FROM {$wpdbPosts} p
                 LEFT JOIN `{$votesTable}` v ON v.post_id = p.ID
                 WHERE p.post_type = %s AND p.post_status = 'publish'
                 GROUP BY p.ID
                 HAVING votes > 0
                 ORDER BY votes DESC, recent_votes DESC, p.post_date_gmt DESC
                 LIMIT %d",
                $since,
                $postType,
                self::MOST_REQUESTED_LIMIT
            )
        );
        // phpcs:enable WordPress.DB.DirectDatabaseQuery

        return array_map(
            static fn ($row) => [
                'id'          => (int) $row->id,
                'title'       => wp_specialchars_decode($row->title, ENT_QUOTES),
                'url'         => PortalLocation::topicUrl((int) $row->id),
                'votes'       => (int) $row->votes,
                'recentVotes' => (int) $row->recent_votes,
                'replies'     => (int) $row->replies,
            ],
            $rows
        );
    }

    private function getRecentTopics(string $postType, string $votesTable): array
    {
        $wpdbPosts = Connection::prop('posts');
        $wpdbUsers = Connection::prop('users');

        // phpcs:disable WordPress.DB.DirectDatabaseQuery
        $rows = Connection::get_results(
            Connection::prepare(
                "SELECT p.ID AS id,
                        p.post_title AS title,
                        u.display_name AS author,
                        p.post_date_gmt AS created_at,
                        COUNT(v.id) AS votes
                 FROM {$wpdbPosts} p
                 LEFT JOIN {$wpdbUsers} u ON p.post_author = u.ID
                 LEFT JOIN `{$votesTable}` v ON v.post_id = p.ID
                 WHERE p.post_type = %s AND p.post_status = 'publish'
                 GROUP BY p.ID
                 ORDER BY p.post_date_gmt DESC
                 LIMIT %d",
                $postType,
                self::RECENT_TOPICS_LIMIT
            )
        );
        // phpcs:enable WordPress.DB.DirectDatabaseQuery

        return array_map(
            static fn ($row) => [
                'id'         => (int) $row->id,
                'title'      => wp_specialchars_decode($row->title, ENT_QUOTES),
                'url'        => PortalLocation::topicUrl((int) $row->id),
                'author'     => $row->author,
                'created_at' => $row->created_at,
                'votes'      => (int) $row->votes,
            ],
            $rows
        );
    }

    /**
     * The members who did the most during the period, ranked three ways: by
     * votes and comments together, by votes their topics received, and by
     * comments they wrote. Each ranking is its own short list, so switching it
     * on the dashboard shows that ranking's leaders rather than re-sorting
     * another's.
     *
     * A vote a member casts on their own topic is not counted toward them, and
     * deleted members drop out with the join on the users table.
     */
    private function getTopContributors(string $postType, string $votesTable, string $since): array
    {
        $wpdbComments = Connection::prop('comments');
        $wpdbPosts = Connection::prop('posts');
        $wpdbUsers = Connection::prop('users');

        $contributions = Connection::prepare(
            "SELECT t.user_id, SUM(t.votes) AS votes, SUM(t.comments) AS comments
             FROM (
                SELECT p.post_author AS user_id, COUNT(*) AS votes, 0 AS comments
                FROM `{$votesTable}` v
                INNER JOIN {$wpdbPosts} p ON p.ID = v.post_id
                WHERE p.post_type = %s AND p.post_status = 'publish'
                  AND p.post_author > 0 AND v.user_id <> p.post_author
                  AND v.created_at >= %s
                GROUP BY p.post_author
                UNION ALL
                SELECT c.user_id, 0 AS votes, COUNT(*) AS comments
                FROM {$wpdbComments} c
                INNER JOIN {$wpdbPosts} p ON c.comment_post_ID = p.ID
                WHERE c.comment_approved = '1' AND c.user_id > 0
                  AND p.post_type = %s AND p.post_status = 'publish'
                  AND c.comment_date_gmt >= %s
                GROUP BY c.user_id
             ) t
             INNER JOIN {$wpdbUsers} u ON u.ID = t.user_id
             GROUP BY t.user_id",
            $postType,
            $since,
            $postType,
            $since
        );

        // The ORDER BY clauses are fixed strings, never request input.
        $rankings = [
            'overall'  => 'votes + comments DESC, votes DESC',
            'votes'    => 'votes DESC, comments DESC',
            'comments' => 'comments DESC, votes DESC',
        ];

        // phpcs:disable WordPress.DB.DirectDatabaseQuery, WordPress.DB.PreparedSQL.NotPrepared
        $count = (int) Connection::get_var("SELECT COUNT(*) FROM ({$contributions}) contributors");

        $lists = [];
        foreach ($rankings as $key => $order) {
            $rows = Connection::get_results(
                "SELECT * FROM ({$contributions}) contributors
                 WHERE " . ($key === 'overall' ? '1 = 1' : "{$key} > 0") . "
                 ORDER BY {$order}, user_id ASC
                 LIMIT " . self::TOP_CONTRIBUTORS_LIMIT
            );

            $lists[$key] = array_map([$this, 'contributor'], \is_array($rows) ? $rows : []);
        }
        // phpcs:enable WordPress.DB.DirectDatabaseQuery, WordPress.DB.PreparedSQL.NotPrepared

        return ['count' => $count] + $lists;
    }

    private function contributor(object $row): array
    {
        $userId = (int) $row->user_id;
        $user = get_userdata($userId);
        $badge = UserBadgeService::for($userId);

        return [
            'id'       => $userId,
            'name'     => $user ? $user->display_name : '',
            'avatar'   => get_avatar_url($userId, ['size' => 80]),
            'badge'    => $badge['label'] ?? null,
            'votes'    => (int) $row->votes,
            'comments' => (int) $row->comments,
        ];
    }

    /**
     * Each topic's stage, looked up in one query for every row on the page.
     *
     * @param int[] $topicIds
     *
     * @return array<int, array{name: string, color: null|string}>
     */
    private function stagesFor(array $topicIds): array
    {
        $topicIds = array_values(array_unique(array_filter($topicIds)));

        if ($topicIds === []) {
            return [];
        }

        // One query primes the cache for every topic; get_the_terms() below
        // then reads from it instead of querying per row.
        update_object_term_cache($topicIds, PostTypes::BIT_CONNECT->value);

        $stages = [];
        foreach ($topicIds as $topicId) {
            $terms = get_the_terms($topicId, Taxonomies::STAGES->value);

            if (!\is_array($terms) || $terms === []) {
                continue;
            }

            $stages[$topicId] = [
                'name'  => wp_specialchars_decode($terms[0]->name, ENT_QUOTES),
                'color' => $this->stageColor($terms[0]->term_id),
            ];
        }

        return $stages;
    }

    private function withStage(array $rows, array $stages): array
    {
        return array_map(
            static fn ($row) => $row + ['stage' => $stages[$row['id']] ?? null],
            $rows
        );
    }

    private function stageColor(int $termId): ?string
    {
        $color = get_term_meta($termId, 'bit_connect_color', true);

        return \is_string($color) && $color !== '' ? $color : null;
    }
}
