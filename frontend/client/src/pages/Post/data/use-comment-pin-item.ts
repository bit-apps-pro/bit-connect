import { type MenuProps } from 'antd'

import { type Comment } from '@/types/post'

export interface CommentPinContext {
  comment: Comment
  /**
   * Who opened the topic — the only member who may pin a reply in it.
   *
   * No topic id travels with it: a pin is addressed by the comment, and the
   * server reads the topic off that. Sending one as well would be a second,
   * unchecked claim about which topic the reply belongs to.
   */
  topicAuthorId: number
}

/** One entry for the reply's ⋯ menu, or nothing to add to it. */
export type CommentPinItem = NonNullable<MenuProps['items']>[number] | undefined

/**
 * The reply's ⋯ menu gains no pin entry.
 *
 * This plugin holds no route that could write a pin, so an entry offering to
 * would be an offer it cannot keep. The menu is built by pushing whatever this
 * returns, so `undefined` leaves it exactly as it was.
 */
const useCommentPinItem: (context: CommentPinContext) => CommentPinItem = () => undefined

export default useCommentPinItem
