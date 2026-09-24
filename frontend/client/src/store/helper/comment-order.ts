import { type Comment } from '@/types/post'

/**
 * Orders a thread by a sort option the main sorter does not perform itself.
 *
 * Returns the ordered copy, or `undefined` when the option is not one it
 * knows, in which case the caller falls back to newest-first.
 */
export type CommentOrder = (comments: Comment[], sortOption: string) => Comment[] | undefined

/**
 * No extra orderings: `newest` and `all` are handled before this is asked,
 * and nothing else is offered, so nothing else is claimed.
 */
const orderComments: CommentOrder = () => {
  // eslint-disable-next-line unicorn/no-useless-undefined -- "nothing claimed" is the contract's spelled-out answer
  return undefined
}

export default orderComments
