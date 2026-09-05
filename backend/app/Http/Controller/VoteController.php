<?php

namespace BitApps\BitConnect\Http\Controller;

// Prevent direct script access
if (!\defined('ABSPATH')) {
    exit;
}

use BitApps\BitConnect\Deps\BitApps\WPKit\Http\Response;
use BitApps\BitConnect\Http\Requests\GetCommentVotesRequest;
use BitApps\BitConnect\Http\Requests\GetPostVotesRequest;
use BitApps\BitConnect\Http\Requests\ToggleCommentVoteRequest;
use BitApps\BitConnect\Http\Requests\TogglePostVoteRequest;
use BitApps\BitConnect\Services\VoteService;

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

    public function toggleCommentVote(ToggleCommentVoteRequest $request)
    {
        $commentId = (int) $request->id;
        $comment = get_comment($commentId);

        if (!$comment) {
            return Response::error(__('Comment not found.', 'bit-connect'))->httpStatus(404);
        }

        $result = $this->voteService->toggleCommentVote(get_current_user_id(), $commentId);

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

    public function getCommentVotes(GetCommentVotesRequest $request)
    {
        return Response::success(
            $this->voteService->getCommentVoteStatus((int) $request->id, get_current_user_id())
        );
    }
}
