import { IS_PRO_ACTIVE } from '@common/helpers/pro-access'
import { type MenuProps } from 'antd'

import { type Comment } from '@/types/post'

import useCommentPinItemFree from './use-comment-pin-item.free'
import useCommentPinItemPro from './use-comment-pin-item.pro'

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
 * The "Pin"/"Unpin" entry for a reply's ⋯ menu, when the forum has pinning.
 *
 * An extension point rather than a branch: this plugin has no pin action to
 * gate, so the free implementation does not hide an entry — there is no entry.
 * The add-on supplies one, along with the request that writes it.
 *
 * Selected at module scope, so the call site stays a single unconditional hook
 * call and the rules of hooks hold: which implementation is chosen is fixed for
 * the life of the bundle.
 */
const useCommentPinItem: (context: CommentPinContext) => CommentPinItem = IS_PRO_ACTIVE
  ? useCommentPinItemPro
  : useCommentPinItemFree

export default useCommentPinItem
