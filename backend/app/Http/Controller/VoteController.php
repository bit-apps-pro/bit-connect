<?php

namespace BitApps\BitConnect\Http\Controller;

// Prevent direct script access
if (!defined('ABSPATH')) {
    exit;
}

use BitApps\BitConnect\Deps\BitApps\WPKit\Http\Response;
use BitApps\BitConnect\Http\Requests\GetPostVotesRequest;
use BitApps\BitConnect\Http\Requests\TogglePostVoteRequest;
use BitApps\BitConnect\Services\VoteService;

/**
 * Upvoting a topic.
 *
 * Topics only. Upvoting an individual reply is not a thing this plugin does
 * withhold — it is a thing this plugin does not implement: there is no route,
 * no service method and no request class for it here. That feature ships in
 * the Bit Connect Pro add-on, which registers its own endpoints.
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
        return Response::success(
            $this->voteService->getPostVoteStatus((int) $request->id, get_current_user_id())
        );
    }
}
