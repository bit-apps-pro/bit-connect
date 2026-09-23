import { IS_PRO_ACTIVE } from '@common/helpers/pro-access'
import { type ReactNode } from 'react'

import { type Comment } from '@/types/post'

import useCommentVoteFree from './use-comment-vote.free'
import useCommentVotePro from './use-comment-vote.pro'

/**
 * What the thread needs in order to offer upvoting on a reply.
 *
 * `renderVote` draws the control for one reply, handler and all. Absent, the
 * thread renders no control at all — CommentItem treats the prop as optional —
 * so a forum without one shows a reply with no upvote button rather than a
 * disabled one. This plugin does not implement upvotes on replies, so its own
 * sibling answers with nothing.
 */
export interface CommentVote {
  renderVote?: (comment: Comment) => ReactNode
}

/**
 * Dispatch only — see the two siblings.
 *
 * Selected at module scope rather than inside the page, because the two sides
 * are hooks and choosing between them in a component body would break the
 * rules of hooks. `IS_PRO_ACTIVE` folds to `false` in this plugin's bundle, so
 * Rollup drops the other side and everything it imports.
 */
const useCommentVote: () => CommentVote = IS_PRO_ACTIVE ? useCommentVotePro : useCommentVoteFree

export default useCommentVote
