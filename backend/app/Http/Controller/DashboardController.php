<?php

namespace BitApps\BitConnect\Http\Controller;

// Prevent direct script access
if (!\defined('ABSPATH')) {
    exit;
}

use BitApps\BitConnect\Config;
use BitApps\BitConnect\Deps\BitApps\WPDatabase\Connection;
use BitApps\BitConnect\Deps\BitApps\WPKit\Http\Response;
use BitApps\BitConnect\Enum\PostTypes;
use BitApps\BitConnect\Http\Requests\GetDashboardRequest;

final class DashboardController
{
    public function get(GetDashboardRequest $_request) // phpcs:ignore VariableAnalysis.CodeAnalysis.VariableAnalysis.UnusedVariable
    {
        $wpdbPrefix = Connection::prop('prefix');

        $postType = PostTypes::BIT_CONNECT->value;
        $votesTable = $wpdbPrefix . Config::VAR_PREFIX . 'votes';

        return Response::success(
            [
                'stats'           => $this->getStats($postType, $votesTable),
                'monthlyActivity' => $this->getMonthlyActivity($postType),
                'topTopics'       => $this->getTopTopics($postType, $votesTable),
                'recentTopics'    => $this->getRecentTopics($postType, $votesTable),
            ]
        );
    }

    private function getStats(string $postType, string $votesTable): array
    {
        $wpdbComments = Connection::prop('comments');
        $wpdbPosts = Connection::prop('posts');
        $wpdbUsers = Connection::prop('users');

        $totalTopics = (int) wp_count_posts($postType)->publish;

        // phpcs:disable WordPress.DB.DirectDatabaseQuery
        $totalComments = (int) Connection::get_var(
            Connection::prepare(
                "SELECT COUNT(*) FROM {$wpdbComments} c
                 INNER JOIN {$wpdbPosts} p ON c.comment_post_ID = p.ID
                 WHERE c.comment_approved = '1'
                   AND p.post_type = %s
                   AND p.post_status = 'publish'",
                $postType
            )
        );

        $totalMembers = (int) Connection::get_var("SELECT COUNT(*) FROM {$wpdbUsers}"); // phpcs:ignore WordPress.DB.DirectDatabaseQuery

        $totalVotes = (int) Connection::get_var("SELECT COUNT(*) FROM `{$votesTable}`"); // phpcs:ignore WordPress.DB.DirectDatabaseQuery
        // phpcs:enable WordPress.DB.DirectDatabaseQuery

        return [
            'totalTopics'   => $totalTopics,
            'totalComments' => $totalComments,
            'totalMembers'  => $totalMembers,
            'totalVotes'    => $totalVotes,
        ];
    }

    private function getMonthlyActivity(string $postType): array
    {
        $wpdbComments = Connection::prop('comments');
        $wpdbPosts = Connection::prop('posts');

        $twelveMonthsAgo = gmdate('Y-m-01', strtotime('-11 months'));

        // phpcs:disable WordPress.DB.DirectDatabaseQuery
        $topicRows = Connection::get_results(
            Connection::prepare(
                "SELECT DATE_FORMAT(post_date, '%%Y-%%m') AS month_key,
                        DATE_FORMAT(post_date, '%%b %%Y') AS month,
                        COUNT(*) AS topics
                 FROM {$wpdbPosts}
                 WHERE post_type = %s
                   AND post_status = 'publish'
                   AND post_date >= %s
                 GROUP BY month_key
                 ORDER BY month_key ASC",
                $postType,
                $twelveMonthsAgo
            )
        );

        $commentRows = Connection::get_results(
            Connection::prepare(
                "SELECT DATE_FORMAT(c.comment_date, '%%Y-%%m') AS month_key,
                        COUNT(*) AS comments
                 FROM {$wpdbComments} c
                 INNER JOIN {$wpdbPosts} p ON c.comment_post_ID = p.ID
                 WHERE p.post_type = %s
                   AND p.post_status = 'publish'
                   AND c.comment_approved = '1'
                   AND c.comment_date >= %s
                 GROUP BY month_key
                 ORDER BY month_key ASC",
                $postType,
                $twelveMonthsAgo
            )
        );
        // phpcs:enable WordPress.DB.DirectDatabaseQuery

        // Build a map of all 12 months
        $months = [];
        for ($i = 11; $i >= 0; --$i) {
            $key = gmdate('Y-m', strtotime("-{$i} months"));
            $label = gmdate('M Y', strtotime("-{$i} months"));
            $months[$key] = ['month' => $label, 'topics' => 0, 'comments' => 0];
        }

        foreach ($topicRows as $row) {
            if (isset($months[$row->month_key])) {
                $months[$row->month_key]['topics'] = (int) $row->topics;
            }
        }

        foreach ($commentRows as $row) {
            if (isset($months[$row->month_key])) {
                $months[$row->month_key]['comments'] = (int) $row->comments;
            }
        }

        return array_values($months);
    }

    private function getTopTopics(string $postType, string $votesTable): array
    {
        $wpdbPosts = Connection::prop('posts');

        // phpcs:disable WordPress.DB.DirectDatabaseQuery
        $rows = Connection::get_results(
            Connection::prepare(
                "SELECT p.ID AS id, p.post_title AS title, COUNT(v.id) AS vote_count
                 FROM {$wpdbPosts} p
                 LEFT JOIN `{$votesTable}` v ON v.post_id = p.ID
                 WHERE p.post_type = %s AND p.post_status = 'publish'
                 GROUP BY p.ID
                 ORDER BY vote_count DESC, p.post_date DESC
                 LIMIT 8",
                $postType
            )
        );
        // phpcs:enable WordPress.DB.DirectDatabaseQuery

        return array_map(
            static function ($row) {
                return [
                    'id'         => (int) $row->id,
                    'title'      => $row->title,
                    'vote_count' => (int) $row->vote_count,
                ];
            },
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
                        p.post_date AS created_at,
                        COUNT(v.id) AS vote_count
                 FROM {$wpdbPosts} p
                 LEFT JOIN {$wpdbUsers} u ON p.post_author = u.ID
                 LEFT JOIN `{$votesTable}` v ON v.post_id = p.ID
                 WHERE p.post_type = %s AND p.post_status = 'publish'
                 GROUP BY p.ID
                 ORDER BY p.post_date DESC
                 LIMIT 10",
                $postType
            )
        );
        // phpcs:enable WordPress.DB.DirectDatabaseQuery

        return array_map(
            static function ($row) {
                return [
                    'id'         => (int) $row->id,
                    'title'      => $row->title,
                    'author'     => $row->author,
                    'created_at' => $row->created_at,
                    'vote_count' => (int) $row->vote_count,
                ];
            },
            $rows
        );
    }
}
