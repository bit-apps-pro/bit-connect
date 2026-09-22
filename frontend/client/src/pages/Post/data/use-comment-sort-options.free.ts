import { __ } from '@common/helpers/i18nWrap'

import { type CommentSortChoice } from './use-comment-sort-options'

/**
 * By date, either way round — the two orderings this plugin can actually
 * perform. A module-level constant so the Select does not see a new array on
 * every render of the topic page.
 */
const BY_DATE: CommentSortChoice[] = [
  { label: __('Newest'), value: 'newest' },
  { label: __('All comments'), value: 'all' }
]

export default function useCommentSortOptionsFree(): CommentSortChoice[] {
  return BY_DATE
}
