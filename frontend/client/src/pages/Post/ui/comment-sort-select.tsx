import { __ } from '@common/helpers/i18nWrap'
import { Select } from 'antd'

import { type SortOption } from '@/store/single-post.type'

import useCommentSortOptions from '../data/use-comment-sort-options'

/**
 * Sort control for the comment thread.
 *
 * Lives beside the "Comments" heading rather than above the list: on its own
 * row it sat between the editor and the first comment, where it read as part of
 * the editor and pushed the thread another ~56px down the page.
 */
export default function CommentSortSelect({
  onChange,
  value
}: {
  onChange: (value: SortOption) => void
  value: SortOption
}) {
  // The choices are an extension point — see use-comment-sort-options.
  const options = useCommentSortOptions()

  return (
    <Select
      aria-label={__('Sort comments')}
      onChange={next => {
        if (options.some(option => option.value === next)) onChange(next)
      }}
      options={options}
      value={value}
      variant="borderless"
    />
  )
}
