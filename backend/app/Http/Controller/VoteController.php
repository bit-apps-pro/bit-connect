<?php

namespace BitApps\BitConnect\Http\Controller;

// Prevent direct script access
if (!defined('ABSPATH')) {
    exit;
}

use BitApps\BitConnect\Deps\BitApps\WPKit\Http\Response;
use BitApps\BitConnect\Enum\PostTypes;
use BitApps\BitConnect\Http\Requests\GetPostVotesRequest;
use BitApps\BitConnect\Http\Requests\TogglePostVoteRequest;
use BitApps\BitConnect\Services\TopicService;
use BitApps\BitConnect\Services\VoteService;

/**
 * Upvoting a topic.
 *
 * Topics only. Upvoting an individual reply is not something this plugin
 * implements: there is no route, no service method and no request class for
 * it here.
 */
final class VoteController
{
    private VoteService $voteService;

    public function __construct()
    {
        $this->voteService = new VoteService();
    }

    public function togglePostVote(TogglePostVoteRequest $request)
    {
        $postId = (int) $request->id;
        $post = get_post($postId);

        if (!$post) {
            return Response::error(__('Post not found.', 'bit-connect'))->httpStatus(404);
        }

        $result = $this->voteService->togglePostVote(get_current_user_id(), $postId);

        if (!$result['success']) {
            return Response::error($result['message'])->httpStatus(!empty($result['denied']) ? 403 : 400);
        }

        return Response::success($result['data']);
    }

    public function getPostVotes(GetPostVotesRequest $request)
    {
        // Even a count says a private topic exists; answer as for a missing one.
        $post = get_post((int) $request->id);

        if (!$post || $post->post_type !== PostTypes::BIT_CONNECT->value || !TopicService::isReadable($post)) {
            return Response::error('Post not found', 404);
        }

        return Response::success(
            $this->voteService->getPostVoteStatus((int) $request->id, get_current_user_id())
        );
    }
}
