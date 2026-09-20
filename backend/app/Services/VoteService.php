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
 * Upvoting a topic.
 *
 * Voting is a simple toggle: one vote per user per topic.
 * Casting a vote when one already exists removes it (toggle off).
 *
 *   - Capability checks via current_user_can()
 *   - Rate limiting via VoteRateLimiter
 *   - Cached totals in postmeta (_bit_connect_vote_count)
 *   - Dropping the author's cached profile totals, since a vote moves the
 *     "Upvotes" figure on their card and nothing in core announces one
 *
 * Topics only. Upvoting an individual reply is implemented in the Bit Connect
 * Pro add-on and not here — there is no method on this class that casts one.
 * What remains on the comment side is deleteCommentVotes(), which is
 * housekeeping for this plugin's own table rather than a feature: a deleted
 * comment must not leave rows behind pointing at it.
 */
class VoteService
{
    /**
     * Meta key used in postmeta and commentmeta for the cached vote total.
     */
    public const META_VOTE_COUNT = '_bit_connect_vote_count';

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

    public function rebuildPostVoteCache(int $postId): void
    {
        update_post_meta($postId, self::META_VOTE_COUNT, Vote::getPostVoteCount($postId));
    }

    // -------------------------------------------------------------------------
    // Cleanup
    // -------------------------------------------------------------------------

    public function deletePostVotes(int $postId): bool
    {
        delete_post_meta($postId, self::META_VOTE_COUNT);

        return Vote::deleteAllVotesForPost($postId);
    }

    /**
     * Clears away anything stored against a comment that is being deleted.
     *
     * Kept although this plugin no longer casts comment votes. The votes table
     * is this plugin's, and a deleted comment must not leave rows in it
     * pointing at a comment_ID that no longer exists — whoever wrote them. The
     * add-on writes those rows; cleaning up after its own table is still this
     * plugin's job, and on a site without the add-on it tidies whatever an
     * earlier version left behind.
     */
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
