<?php

namespace BitApps\BitConnect\Http\Controller;

// Prevent direct script access
if (!defined('ABSPATH')) {
    exit;
}

use BitApps\BitConnect\Deps\BitApps\WPKit\Hooks\Hooks;
use BitApps\BitConnect\Deps\BitApps\WPKit\Http\Response;
use BitApps\BitConnect\Enum\PostTypes;
use BitApps\BitConnect\Http\Requests\CreatePostRequest;
use BitApps\BitConnect\Http\Requests\GetAllPostsRequest;
use BitApps\BitConnect\Http\Requests\GetPostRequest;
use BitApps\BitConnect\Model\Vote;
use BitApps\BitConnect\Services\TopicService;

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

        // get_post() answers for any post on the site, of any type and status.
        // This endpoint serves forum topics, and only the ones the viewer may
        // read — otherwise a guest could page through drafts and private posts
        // by ID. A private or hidden topic answers exactly like a missing one,
        // so the response does not confirm that there is something behind it.
        if (!$post || $post->post_type !== PostTypes::BIT_CONNECT->value || !TopicService::isReadable($post)) {
            return Response::error('Post not found', 404);
        }

        $voteCount = Vote::getPostVoteCount($post->ID);

        $hasVoted = false;
        if (is_user_logged_in()) {
            $currentUserId = get_current_user_id();
            $userVote = Vote::hasUserVoted($currentUserId, $post->ID);
            $hasVoted = !empty($userVote);
        }

        $attachments = get_post_meta($post->ID, '_bit_connect_post_attachments', true) ?: [];

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
}
