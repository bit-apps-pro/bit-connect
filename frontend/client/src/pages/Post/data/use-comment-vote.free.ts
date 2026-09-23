import { type CommentVote } from './use-comment-vote'

/**
 * Upvoting a reply: not offered.
 *
 * Answers neutrally rather than returning a control that refuses. There is no
 * endpoint behind it in this plugin and no count to move, so the honest answer
 * is that the thread has no upvote control — not that it has one which says no.
 */
export default function useCommentVoteFree(): CommentVote {
  return {}
}
