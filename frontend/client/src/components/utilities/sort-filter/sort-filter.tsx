import { __ } from '@common/helpers/i18nWrap'
import useHasPrivateTopics from '@features/topic-modal/data/use-private-topics-available'
import { deleteFilter, readFilter, urlParam } from '@utils/portal-query'
import { Select } from 'antd'
import { useMemo } from 'react'
import { useSearchParams } from 'react-router'

import { useAuthStore } from '@/store/auth.zustand'

import useAddedViews from './use-added-views'

// `topic-types` is not among them: the type has its own chip row now (see
// topic-type-filter), and choosing an order must not clear it.
const FILTER_KEYS = ['sort', 'visibility', 'my_topics', 'view'] as const

/** A named list's option value, kept apart from the orderings' own values. */
const VIEW_PREFIX = 'view:'

/**
 * @param block a full-width field, for a control given a row of its own — the
 *              phone filter sheet — rather than a slot in the desktop toolbar.
 */
export default function SortFilter({
  block = false,
  loading = false
}: {
  block?: boolean
  loading?: boolean
}) {
  const [searchParams, setSearchParams] = useSearchParams()
  const { isLoggedIn } = useAuthStore()
  const hasPrivateTopics = useHasPrivateTopics()
  const views = useAddedViews()

  const currentValue = (() => {
    // Only a list this control offers: a stale `?view=` must not show as a raw value.
    const view = searchParams.get('view')
    if (view && views.some(offered => offered.value === view)) return VIEW_PREFIX + view
    if (readFilter(searchParams, 'my_topics') === 'true') return 'my_topics'
    if (searchParams.get('visibility') === 'private') return 'private'
    return searchParams.get('sort') ?? 'newest'
  })()

  const handleChange = (value: string) => {
    setSearchParams(prev => {
      if (prev.has('page')) {
        prev.set('page', '1')
      }

      for (const key of FILTER_KEYS) {
        deleteFilter(prev, key)
      }

      if (value.startsWith(VIEW_PREFIX)) {
        prev.set('view', value.slice(VIEW_PREFIX.length))
      } else if (value === 'private') {
        prev.set('visibility', 'private')
      } else if (value === 'my_topics') {
        prev.set(urlParam('my_topics'), 'true')
      } else if (value === 'oldest') {
        prev.set('sort', 'oldest')
      }

      return prev
    })
  }

  const options = useMemo(
    () => [
      { label: __('Newest'), value: 'newest' },
      { label: __('Oldest'), value: 'oldest' },
      // The Private filter is dropped with the feature: without it the option
      // is a filter that can only ever come back empty, since this plugin has
      // no code that makes a topic private. It stays while the visitor is
      // actually looking at that filter, so an existing bookmark — or a forum
      // that already holds private topics, which stay readable here — does not
      // land on a Select with a value it cannot show.
      ...(isLoggedIn && (hasPrivateTopics || currentValue === 'private')
        ? [{ label: __('Private'), value: 'private' }]
        : []),
      ...(isLoggedIn ? [{ label: __('My Posts'), value: 'my_topics' }] : []),
      ...views.map(view => ({ label: view.label, value: VIEW_PREFIX + view.value }))
    ],
    [isLoggedIn, hasPrivateTopics, currentValue, views]
  )

  return (
    <Select
      className={
        block
          ? 'topics-filter-select topics-field-select bc-w-full'
          : 'field-sizing-content topics-filter-select'
      }
      loading={loading}
      onChange={handleChange}
      options={options}
      popupMatchSelectWidth={block}
      // The type chips' height: the picker shares their row on every width.
      size={block ? 'large' : 'middle'}
      value={currentValue}
    />
  )
}
