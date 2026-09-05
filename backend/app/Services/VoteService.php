<?php

namespace BitApps\BitConnect\Services;

// Prevent direct script access
if (!defined('ABSPATH')) {
    exit;
}

use BitApps\BitConnect\Deps\BitApps\WPKit\Utils\Capabilities as WpCapabilities;
use BitApps\BitConnect\Enum\Capabilities;
use BitApps\BitConnect\Enum\NotificationTypes;
use BitApps\BitConnect\Enum\PostTypes as EnumPostTypes;
use BitApps\BitConnect\Model\Vote;

/**
 * VoteService handles all voting business logic.
 *
 * Voting is a simple toggle: one vote per user per entity.
 * Casting a vote when one already exists removes it (toggle off).
 *
 * Features added over the legacy implementation:
 *   - Capability checks via current_user_can()
 *   - Rate limiting via VoteRateLimiter
 *   - Cached totals in postmeta / commentmeta (_bc_vote_count)
 *   - Dropping the author's cached profile totals, since a vote moves the
 *     "Upvotes" figure on their card and nothing in core announces one
 */
class VoteService
{
    /**
     * Meta key used in postmeta and commentmeta for the cached vote total.
     */
    public const META_VOTE_COUNT = '_bc_vote_count';

    // -------------------------------------------------------------------------
    // Post voting
    // -------------------------------------------------------------------------

    public function togglePostVote(int $userId, int $postId): array
    {
        if (!WpCapabilities::check(Capabilities::VOTE_POST->value)) {
            return $this->denied(__('You do not have permission to vote on posts.', 'bit-connect'));
        }

        if (!VoteRateLimiter::isAllowed($userId)) {
            return $this->denied(VoteRateLimiter::errorMessage());
        }

        $post = get_post($postId);

        if (!$post || $post->post_type !== EnumPostTypes::BIT_CONNECT->value) {
            return $this->error(__('Invalid post.', 'bit-connect'));
        }

        if (Vote::hasUserVoted($userId, $postId)) {
            Vote::deleteUserVoteForPost($userId, $postId);
            $this->rebuildPostVoteCache($postId);
            UserStatsService::forget($post->post_author);
            VoteRateLimiter::consume($userId);

            return $this->success(__('Vote removed.', 'bit-connect'), $this->postVoteData($postId, $userId));
        }

        $vote = new Vote();
        $vote->fill(['user_id' => $userId, 'post_id' => $postId]);
        $vote->save();
        $this->rebuildPostVoteCache($postId);
        UserStatsService::forget($post->post_author);
        VoteRateLimiter::consume($userId);

        // Only on the way up. Un-voting is not an event anyone needs telling
        // about, and pairing the two would let one person toggle a notification
        // in and out of somebody's bell.
        NotificationService::dispatch(
            NotificationTypes::VOTE_RECEIVED,
            NotificationService::TARGET_TOPIC,
            $postId,
            [
                'topic_title' => (string) $post->post_title,
                'url'         => (string) get_permalink($post),
            ],
            $postId
        );

        return $this->success(__('Vote added.', 'bit-connect'), $this->postVoteData($postId, $userId));
    }

    public function getPostVoteStatus(int $postId, int $userId = 0): array
    {
        return $this->postVoteData($postId, $userId ?: get_current_user_id());
    }

    // -------------------------------------------------------------------------
    // Comment voting
    // -------------------------------------------------------------------------

    public function toggleCommentVote(int $userId, int $commentId): array
    {
        // Asked before the capability, because it is a different question: this
        // is whether the forum offers comment upvotes at all, and a member with
        // every capability in the world cannot use a feature the forum does not
        // have. Checked here rather than only in the portal so a stale page or
        // a hand-made request cannot cast a vote the forum stopped offering.
        if (!PermissionService::canUseCommentUpvotes()) {
            return $this->denied(__('Comment upvoting is not enabled on this forum.', 'bit-connect'));
        }

        if (!WpCapabilities::check(Capabilities::VOTE_COMMENT->value)) {
            return $this->denied(__('You do not have permission to vote on comments.', 'bit-connect'));
        }

        if (!VoteRateLimiter::isAllowed($userId)) {
            return $this->denied(VoteRateLimiter::errorMessage());
        }

        $comment = get_comment($commentId);

        if (!$comment) {
            return $this->error(__('Comment not found.', 'bit-connect'));
        }

        if (Vote::getUserVoteForComment($userId, $commentId)) {
            Vote::deleteUserVoteForComment($userId, $commentId);
            $this->rebuildCommentVoteCache($commentId);
            UserStatsService::forget($comment->user_id);
            VoteRateLimiter::consume($userId);

            return $this->success(__('Vote removed.', 'bit-connect'), $this->commentVoteData($commentId, $userId));
        }

        $vote = new Vote();
        $vote->fill(['user_id' => $userId, 'comment_id' => $commentId]);
        $vote->save();
        $this->rebuildCommentVoteCache($commentId);
        UserStatsService::forget($comment->user_id);
        VoteRateLimiter::consume($userId);

        // See togglePostVote(): the notification rides the vote, not the toggle.
        // Votes are the one collapsible type, so a popular comment is one line
        // in the author's bell rather than fifty.
        NotificationService::dispatch(
            NotificationTypes::VOTE_RECEIVED,
            NotificationService::TARGET_COMMENT,
            $commentId,
            [
                'excerpt' => ActivityLogService::excerpt($comment->comment_content),
                'url'     => (string) get_comment_link($comment),
            ],
            (int) $comment->comment_post_ID
        );

        return $this->success(__('Vote added.', 'bit-connect'), $this->commentVoteData($commentId, $userId));
    }

    public function getCommentVoteStatus(int $commentId, int $userId = 0): array
    {
        return $this->commentVoteData($commentId, $userId ?: get_current_user_id());
    }

    // -------------------------------------------------------------------------
    // Cached vote counts
    // -------------------------------------------------------------------------

    public function getPostVoteCounts(int $postId): int
    {
        $cached = get_post_meta($postId, self::META_VOTE_COUNT, true);

        if ($cached === '') {
            $this->rebuildPostVoteCache($postId);
            $cached = get_post_meta($postId, self::META_VOTE_COUNT, true);
        }

        return (int) $cached;
    }

    public function getCommentVoteCounts(int $commentId): int
    {
        $cached = get_comment_meta($commentId, self::META_VOTE_COUNT, true);

        if ($cached === '') {
            $this->rebuildCommentVoteCache($commentId);
            $cached = get_comment_meta($commentId, self::META_VOTE_COUNT, true);
        }

        return (int) $cached;
    }

    public function rebuildPostVoteCache(int $postId): void
    {
        update_post_meta($postId, self::META_VOTE_COUNT, Vote::getPostVoteCount($postId));
    }

    public function rebuildCommentVoteCache(int $commentId): void
    {
        update_comment_meta($commentId, self::META_VOTE_COUNT, Vote::getCommentVoteCount($commentId));
    }

    // -------------------------------------------------------------------------
    // Cleanup
    // -------------------------------------------------------------------------

    public function deletePostVotes(int $postId): bool
    {
        delete_post_meta($postId, self::META_VOTE_COUNT);

        return Vote::deleteAllVotesForPost($postId);
    }

    public function deleteCommentVotes(int $commentId): bool
    {
        delete_comment_meta($commentId, self::META_VOTE_COUNT);

        return Vote::deleteAllVotesForComment($commentId);
    }

    public function deleteUserVotes(int $userId): bool
    {
        return Vote::deleteAllVotesByUser($userId);
    }

    // -------------------------------------------------------------------------
    // Internals
    // -------------------------------------------------------------------------

    private function postVoteData(int $postId, int $userId): array
    {
        return [
            'votes'    => $this->getPostVoteCounts($postId),
            'hasVoted' => $userId > 0 && Vote::hasUserVoted($userId, $postId),
        ];
    }

    private function commentVoteData(int $commentId, int $userId): array
    {
        return [
            'votes'    => $this->getCommentVoteCounts($commentId),
            'hasVoted' => $userId > 0 && Vote::hasUserVotedComment($userId, $commentId),
        ];
    }

    private function success(string $message, array $data): array
    {
        return ['success' => true, 'message' => $message, 'data' => $data];
    }

    private function error(string $message): array
    {
        return ['success' => false, 'message' => $message, 'data' => null];
    }

    private function denied(string $message): array
    {
        return ['success' => false, 'message' => $message, 'data' => null, 'denied' => true];
    }
}
