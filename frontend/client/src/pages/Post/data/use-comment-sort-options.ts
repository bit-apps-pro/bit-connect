import { __ } from '@common/helpers/i18nWrap'

export interface CommentSortChoice {
  label: string
  value: string
}

/**
 * By date, either way round — the two orderings this plugin can actually
 * perform. A module-level constant so the Select does not see a new array on
 * every render of the topic page.
 */
const BY_DATE: CommentSortChoice[] = [
  { label: __('Newest'), value: 'newest' },
  { label: __('All comments'), value: 'all' }
]

/**
 * Which orderings the thread offers.
 *
 * The server accepts `newest` and `all` and coerces anything else to newest, so
 * this list and the server agree: a choice offered here is one the thread can
 * actually be put in.
 */
export default function useCommentSortOptions(): CommentSortChoice[] {
  return BY_DATE
}
