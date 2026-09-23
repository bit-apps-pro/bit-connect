import { type ReactNode } from 'react'

import { type Comment } from '@/types/post'

/**
 * What the thread needs in order to offer upvoting on a reply.
 *
 * `renderVote` draws the control for one reply, handler and all. Absent, the
 * thread renders no control at all — CommentItem treats the prop as optional —
 * so a forum without one shows a reply with no upvote button rather than a
 * disabled one.
 */
export interface CommentVote {
  renderVote?: (comment: Comment) => ReactNode
}

/**
 * Upvoting a reply: not offered.
 *
 * Answers neutrally rather than returning a control that refuses. This plugin
 * has no endpoint behind it and no count to move, so the honest answer is that
 * the thread has no upvote control — not that it has one which says no.
 */
export default function useCommentVote(): CommentVote {
  return {}
}
