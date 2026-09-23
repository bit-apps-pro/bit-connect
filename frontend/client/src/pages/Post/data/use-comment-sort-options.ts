import { IS_PRO_ACTIVE } from '@common/helpers/pro-access'

import useCommentSortOptionsFree from './use-comment-sort-options.free'
import useCommentSortOptionsPro from './use-comment-sort-options.pro'

export interface CommentSortChoice {
  label: string
  value: string
}

/**
 * Which orderings the thread offers.
 *
 * An extension point rather than a fixed list, because "Most voted" needs
 * upvotes on replies and this plugin does not implement them: the server
 * accepts `newest` and `all` and coerces anything else to newest, so offering
 * a third choice here would be a control that silently did nothing. The
 * add-on that brings reply upvoting brings the ordering with it.
 *
 * Selected at module scope; the two sides are hooks.
 */
const useCommentSortOptions: () => CommentSortChoice[] = IS_PRO_ACTIVE
  ? useCommentSortOptionsPro
  : useCommentSortOptionsFree

export default useCommentSortOptions
