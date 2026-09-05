<?php

namespace BitApps\BitConnect\Http\Controller;

// Prevent direct script access
if (!\defined('ABSPATH')) {
    exit;
}

use BitApps\BitConnect\Config;
use BitApps\BitConnect\Deps\BitApps\WPKit\Hooks\Hooks;
use BitApps\BitConnect\Deps\BitApps\WPKit\Http\Response;
use BitApps\BitConnect\Http\Requests\CreatePostRequest;
use BitApps\BitConnect\Http\Requests\FilterPostRequest;
use BitApps\BitConnect\Http\Requests\GetAllPostsRequest;
use BitApps\BitConnect\Http\Requests\GetPostRequest;
use BitApps\BitConnect\Model\Vote;
use WP_Query;

final class PostController
{
    public function all(?GetAllPostsRequest $_request = null) // phpcs:ignore VariableAnalysis.CodeAnalysis.VariableAnalysis.UnusedVariable
    {
        $posts = get_posts(
            [
                'numberposts' => 10,
                'post_status' => 'publish',
            ]
        );

        $data = [];
        foreach ($posts as $post) {
            $data[] = [
                'id'      => $post->ID,
                'title'   => get_the_title($post),
                'excerpt' => get_the_excerpt($post),
                'link'    => get_permalink($post),
            ];
        }

        return Response::success($data);
    }

    public function create(CreatePostRequest $request)
    {
        $validatedData = $request->validated();

        $title = $validatedData['post_title'] ?? '';
        $description = $validatedData['post_content'] ?? '';

        $postId = wp_insert_post(
            [
                'post_title'   => $title,
                'post_content' => $description,
                'post_excerpt' => $description,
                'post_status'  => 'publish',
                'post_type'    => 'post',
            ]
        );

        if (is_wp_error($postId)) {
            return Response::error('Failed to create post: ' . $postId->get_error_message(), 500);
        }

        $post = get_post($postId);
        if (!$post) {
            return Response::error('Post created but could not be retrieved', 500);
        }

        return Response::success(
            [
                'id'      => $post->ID,
                'title'   => get_the_title($post),
                'excerpt' => get_the_excerpt($post),
                'link'    => get_permalink($post),
            ]
        );
    }

    public function get(GetPostRequest $request)
    {
        $postId = $request->id;

        $post = get_post($postId);
        if (!$post) {
            return Response::error('Post not found', 404);
        }

        $voteCount = Vote::getPostVoteCount($post->ID);

        $hasVoted = false;
        if (is_user_logged_in()) {
            $currentUserId = get_current_user_id();
            $userVote = Vote::hasUserVoted($currentUserId, $post->ID);
            $hasVoted = !empty($userVote);
        }

        $attachments = get_post_meta($post->ID, '_post_attachments', true) ?: [];

        return Response::success(
            [
                'id'       => $post->ID,
                'date'     => $post->post_date,
                'date_gmt' => $post->post_date_gmt,
                'guid'     => [
                    'rendered' => $post->guid,
                ],
                'modified'     => $post->post_modified,
                'modified_gmt' => $post->post_modified_gmt,
                'slug'         => $post->post_name,
                'status'       => $post->post_status,
                'type'         => $post->post_type,
                'link'         => get_permalink($post),
                'title'        => [
                    'rendered' => get_the_title($post),
                ],
                'content' => [
                    'rendered'  => Hooks::applyFilter('the_content', $post->post_content),
                    'protected' => !empty($post->post_password),
                ],
                'excerpt' => [
                    'rendered'  => get_the_excerpt($post),
                    'protected' => !empty($post->post_password),
                ],
                'author'         => $post->post_author,
                'featured_media' => get_post_thumbnail_id($post),
                'comment_status' => $post->comment_status,
                'categories'     => wp_get_post_categories($post->ID),
                'tags'           => wp_get_post_tags($post->ID, ['fields' => 'ids']),
                'votes'          => (int) $voteCount,
                'hasVoted'       => $hasVoted,
                'attachments'    => $attachments,
            ]
        );
    }

    public function filter(FilterPostRequest $request)
    {
        $validatedData = $request->validated();

        $taxonomyFilters = [
            'stages'      => $validatedData['stages'] ?? null,
            'departments' => $validatedData['departments'] ?? null,
            'topic-types' => $validatedData['topic-types'] ?? null,
            'statuses'    => $validatedData['statuses'] ?? null,
            'tags'        => $validatedData['tags'] ?? null,
        ];

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

        if (empty($taxQuery)) {
            return Response::error('At least one taxonomy filter is required (stages, departments, topic-types, statuses, or tags)');
        }

        if (\count($taxQuery) > 1) {
            $taxQuery['relation'] = 'AND';
        }

        $query = new WP_Query(
            [
                'post_type'      => Config::SLUG,
                'post_status'    => 'publish',
                'posts_per_page' => -1,
                'tax_query'      => $taxQuery,
            ]
        );

        if (!$query->have_posts()) {
            return Response::success([]);
        }

        $data = [];
        foreach ($query->posts as $post) {
            $data[] = [
                'id'            => $post->ID,
                'title'         => get_the_title($post),
                'excerpt'       => get_the_excerpt($post),
                'content'       => get_the_content(null, false, $post),
                'link'          => get_permalink($post),
                'date'          => get_the_date('Y-m-d', $post),
                'author'        => get_the_author_meta('display_name', $post->post_author),
                'author_email'  => get_the_author_meta('user_email', $post->post_author),
                'author_avatar' => get_avatar_url($post->post_author),
                'author_posts'  => get_author_posts_url($post->post_author),
            ];
        }

        wp_reset_postdata();

        return Response::success($data);
    }
}
