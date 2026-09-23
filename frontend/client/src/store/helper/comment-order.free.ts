import { type CommentOrder } from './comment-order'

/**
 * No extra orderings: `newest` and `all` are handled before this is asked,
 * and nothing else is offered, so nothing else is claimed.
 */
const orderCommentsFree: CommentOrder = () => {
  // eslint-disable-next-line unicorn/no-useless-undefined -- "nothing claimed" is the contract's spelled-out answer
  return undefined
}

export default orderCommentsFree
