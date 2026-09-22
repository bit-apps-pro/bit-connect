import { IS_PRO_ACTIVE } from '@common/helpers/pro-access'

import useCommentVoteFree from './use-comment-vote.free'
import useCommentVotePro from './use-comment-vote.pro'

/**
 * What the thread needs in order to offer upvoting on a reply.
 *
 * `onVote` absent means the control is not rendered at all — CommentList
 * already treats the prop as optional — so a forum without the add-on shows a
 * reply with no upvote button rather than a disabled one.
 */
export interface CommentVote {
  onVote?: (commentId: number) => void
}

/**
 * Dispatch only — see the two siblings.
 *
 * Selected at module scope rather than inside the page, because the two sides
 * are hooks and choosing between them in a component body would break the
 * rules of hooks. `IS_PRO_ACTIVE` folds to `false` in this plugin's bundle, so
 * Rollup drops the pro side and everything it imports.
 */
const useCommentVote: () => CommentVote = IS_PRO_ACTIVE ? useCommentVotePro : useCommentVoteFree

export default useCommentVote
