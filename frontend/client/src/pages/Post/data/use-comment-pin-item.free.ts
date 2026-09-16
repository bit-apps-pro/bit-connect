import { type CommentPinItem } from './use-comment-pin-item'

/**
 * Pinning without the pro add-on: no entry at all.
 *
 * Not a disabled entry and not an upsell — this plugin holds no route that
 * could write a pin, so an entry offering to would be an offer it cannot keep.
 * The ⋯ menu is built by pushing whatever this returns, so `undefined` leaves
 * the menu exactly as it was.
 *
 * Takes no argument on purpose. The answer does not depend on which reply is
 * being asked about, and a parameter named only to be ignored reads as though
 * one day it might not be.
 */
export default function useCommentPinItemFree(): CommentPinItem {
  return undefined
}
