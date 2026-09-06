import { __ } from '@common/helpers/i18nWrap'
import { Select } from 'antd'

export type CommentSortOption = 'all' | 'mostVoted' | 'newest'

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
  onChange: (value: CommentSortOption) => void
  value: CommentSortOption
}) {
  return (
    <Select
      aria-label={__('Sort comments')}
      onChange={next => {
        if (next === 'newest' || next === 'all' || next === 'mostVoted') onChange(next)
      }}
      options={[
        { label: __('Newest'), value: 'newest' },
        { label: __('All comments'), value: 'all' },
        { label: __('Most voted'), value: 'mostVoted' }
      ]}
      value={value}
      variant="borderless"
    />
  )
}
