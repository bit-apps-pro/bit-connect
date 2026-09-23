import { IS_PRO_ACTIVE } from '@common/helpers/pro-access'

import { type Comment } from '@/types/post'

import orderCommentsFree from './comment-order.free'
import orderCommentsPro from './comment-order.pro'

/**
 * Orders a thread by a sort option this plugin does not perform itself.
 *
 * Returns the ordered copy, or `undefined` when the option is not one it
 * knows, in which case the caller falls back to newest-first.
 */
export type CommentOrder = (comments: Comment[], sortOption: string) => Comment[] | undefined

/**
 * Dispatch only — see the two siblings.
 *
 * The frontend twin of a filter: this plugin's own sorter handles `newest` and
 * `all` and asks here about anything else. Its own sibling answers nothing;
 * another plugin that adds a sort choice (use-comment-sort-options) answers
 * with the ordering that choice means. Selected at module scope so the sorter
 * stays a plain function.
 */
const orderComments: CommentOrder = IS_PRO_ACTIVE ? orderCommentsPro : orderCommentsFree

export default orderComments
