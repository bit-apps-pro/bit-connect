<?php

namespace BitApps\BitConnect\Services;

// Prevent direct script access
if (!defined('ABSPATH')) {
    exit;
}

use BitApps\BitConnect\Config;
use BitApps\BitConnect\Deps\BitApps\WPDatabase\Connection;
use BitApps\BitConnect\Enum\PostTypes;
use BitApps\BitConnect\Enum\Taxonomies;

/**
 * A member's activity over a period, for the profile's Overview.
 *
 * Built from the same public content as UserStatsService — published topics,
 * approved comments and the votes cast on those topics — just windowed by date,
 * so it exposes nothing a visitor could not count by reading the portal.
 *
 * Not cached: a profile's Overview is opened far less often than an author card
 * is rendered, and every query here is bounded by one member's own rows.
 */
class UserInsightsService
{
    /** The periods the Overview offers, matching the admin dashboard's. */
    public const PERIODS = ['7d', '30d', '12m', 'all'];

    /** How many topics the "top" list shows. */
    private const TOP_LIMIT = 5;

    /**
     * Totals, top topics and a per-type breakdown for one member.
     *
     * @param int    $userId
     * @param string $period one of PERIODS
     *
     * @return array{
     *     period:string,
     *     totals:array{topics:int, votes_received:int, comments:int},
     *     top_topics:array<int, array>,
     *     breakdown:array<int, array{term_id:int, name:string, color:null|string, count:int}>
     * }
     */
    public function forUser($userId, $period)
    {
        $userId = (int) $userId;
        $period = \in_array($period, self::PERIODS, true) ? $period : '30d';
        $since = $this->periodStart($period);

        return [
            'period' => $period,
            'totals' => [
                'topics'         => $this->countTopics($userId, $since),
                'votes_received' => $this->countVotesReceived($userId, $since),
                'comments'       => $this->countComments($userId, $since),
            ],
            'top_topics' => $this->topTopics($userId, $since),
            'breakdown'  => $this->breakdown($userId, $since),
        ];
    }

    /**
     * The GMT instant a period starts at, or the epoch for all time.
     *
     * Same boundaries as the admin dashboard: the site's midnight at the start of
     * the first day, or of the first month for the twelve-month view.
     */
    private function periodStart(string $period): string
    {
        if ($period === 'all') {
            return '1970-01-01 00:00:00';
        }

        return SiteCalendar::periodStart($period);
    }

    private function countTopics(int $userId, string $since): int
    {
        $wpdbPosts = Connection::prop('posts');

        return (int) Connection::get_var(
            Connection::prepare(
                "SELECT COUNT(*) FROM {$wpdbPosts}
                 WHERE post_author = %d AND post_type = %s AND post_status = 'publish'
                   AND post_date_gmt >= %s",
                $userId,
                PostTypes::BIT_CONNECT->value,
                $since
            )
        );
    }

    /**
     * Approved comments the member left on published portal topics.
     */
    private function countComments(int $userId, string $since): int
    {
        $wpdbComments = Connection::prop('comments');
        $wpdbPosts = Connection::prop('posts');

        return (int) Connection::get_var(
            Connection::prepare(
                "SELECT COUNT(*) FROM {$wpdbComments} c
                 INNER JOIN {$wpdbPosts} p ON p.ID = c.comment_post_ID
                 WHERE c.user_id = %d AND c.comment_approved = '1'
                   AND c.comment_type IN ('', 'comment')
                   AND p.post_type = %s AND p.post_status = 'publish'
                   AND c.comment_date_gmt >= %s",
                $userId,
                PostTypes::BIT_CONNECT->value,
                $since
            )
        );
    }

    /**
     * Votes cast in the period on any of the member's published topics —
     * dated by the vote, so an old topic still earning votes counts.
     */
    private function countVotesReceived(int $userId, string $since): int
    {
        $wpdbPosts = Connection::prop('posts');
        $votes = Connection::prop('prefix') . Config::VAR_PREFIX . 'votes';

        return (int) Connection::get_var(
            Connection::prepare(
                "SELECT COUNT(*) FROM {$votes} v
                 INNER JOIN {$wpdbPosts} p ON p.ID = v.post_id
                 WHERE p.post_author = %d AND p.post_type = %s AND p.post_status = 'publish'
                   AND v.created_at >= %s",
                $userId,
                PostTypes::BIT_CONNECT->value,
                $since
            )
        );
    }

    /**
     * The member's most-voted topics published in the period, replies breaking
     * ties. Each carries its topic type so the row can show where it was filed.
     *
     * @return array<int, array{ID:int, post_title:string, post_name:string, votes:int, comments:int, topic_type:null|array}>
     */
    private function topTopics(int $userId, string $since): array
    {
        $wpdbPosts = Connection::prop('posts');
        $votes = Connection::prop('prefix') . Config::VAR_PREFIX . 'votes';

        $rows = Connection::get_results(
            Connection::prepare(
                "SELECT p.ID, p.post_title, p.post_name, p.comment_count,
                        (SELECT COUNT(*) FROM {$votes} v WHERE v.post_id = p.ID) AS votes
                 FROM {$wpdbPosts} p
                 WHERE p.post_author = %d AND p.post_type = %s AND p.post_status = 'publish'
                   AND p.post_date_gmt >= %s
                 ORDER BY votes DESC, p.comment_count DESC, p.post_date_gmt DESC
                 LIMIT %d",
                $userId,
                PostTypes::BIT_CONNECT->value,
                $since,
                self::TOP_LIMIT
            )
        );

        $topics = [];
        foreach ((array) $rows as $row) {
            $terms = get_the_terms((int) $row->ID, Taxonomies::TOPIC_TYPES->value);
            $type = \is_array($terms) && $terms !== [] ? $terms[0] : null;

            $topics[] = [
                'ID'         => (int) $row->ID,
                'post_title' => wp_specialchars_decode($row->post_title, ENT_QUOTES),
                'post_name'  => $row->post_name,
                'votes'      => (int) $row->votes,
                'comments'   => (int) $row->comment_count,
                'topic_type' => $type ? $this->termSummary($type->term_id, $type->name) : null,
            ];
        }

        return $topics;
    }

    /**
     * How the member's topics in the period split across topic types, largest
     * first. Topics filed under no type are left out rather than bucketed.
     *
     * @return array<int, array{term_id:int, name:string, color:null|string, count:int}>
     */
    private function breakdown(int $userId, string $since): array
    {
        $wpdbPosts = Connection::prop('posts');
        $wpdbRelationships = Connection::prop('term_relationships');
        $wpdbTaxonomy = Connection::prop('term_taxonomy');
        $wpdbTerms = Connection::prop('terms');

        $rows = Connection::get_results(
            Connection::prepare(
                "SELECT t.term_id, t.name, COUNT(DISTINCT p.ID) AS total
                 FROM {$wpdbPosts} p
                 INNER JOIN {$wpdbRelationships} tr ON tr.object_id = p.ID
                 INNER JOIN {$wpdbTaxonomy} tt ON tt.term_taxonomy_id = tr.term_taxonomy_id AND tt.taxonomy = %s
                 INNER JOIN {$wpdbTerms} t ON t.term_id = tt.term_id
                 WHERE p.post_author = %d AND p.post_type = %s AND p.post_status = 'publish'
                   AND p.post_date_gmt >= %s
                 GROUP BY t.term_id, t.name
                 ORDER BY total DESC, t.name ASC",
                Taxonomies::TOPIC_TYPES->value,
                $userId,
                PostTypes::BIT_CONNECT->value,
                $since
            )
        );

        $breakdown = [];
        foreach ((array) $rows as $row) {
            $breakdown[] = $this->termSummary((int) $row->term_id, $row->name) + ['count' => (int) $row->total];
        }

        return $breakdown;
    }

    /**
     * @return array{term_id:int, name:string, color:null|string}
     */
    private function termSummary(int $termId, string $name): array
    {
        $color = get_term_meta($termId, 'bit_connect_color', true);

        return [
            'term_id' => $termId,
            // Stored escaped ("API &amp; Integrations"); JSON wants the text.
            'name'  => wp_specialchars_decode($name, ENT_QUOTES),
            'color' => \is_string($color) && $color !== '' ? $color : null,
        ];
    }
}
