/* eslint-disable react-hooks/exhaustive-deps */
import { __ } from '@common/helpers/i18nWrap'
import { Grid, Select } from 'antd'
import { useMemo } from 'react'
import { useSearchParams } from 'react-router'

import { useAdminSettingsStore } from '@/store/admin-settings.zustand'
import { useAuthStore } from '@/store/auth.zustand'
import { useTaxonomiesStoreSelect } from '@/store/use-taxonomies-store'

const FILTER_KEYS = ['sort', 'visibility', 'my_topics', 'topic-types'] as const

export default function SortFilter({ loading = false }: { loading?: boolean }) {
  const [searchParams, setSearchParams] = useSearchParams()
  const { isLoggedIn } = useAuthStore()
  const { topicAccess } = useAdminSettingsStore(s => s.settings)

  const currentValue = (() => {
    if (searchParams.get('my_topics') === 'true') return 'my_topics'
    if (searchParams.get('visibility') === 'private') return 'private'
    if (searchParams.get('topic-types')) return searchParams.get('topic-types') as string
    return searchParams.get('sort') ?? 'newest'
  })()

  const handleChange = (value: string) => {
    setSearchParams(prev => {
      if (prev.has('page')) {
        prev.set('page', '1')
      }

      for (const key of FILTER_KEYS) {
        prev.delete(key)
      }

      if (value === 'private') {
        prev.set('visibility', 'private')
      } else if (value === 'my_topics') {
        prev.set('my_topics', 'true')
      } else if (value === 'oldest') {
        prev.set('sort', 'oldest')
      } else if (value !== 'newest') {
        // Topic-type slugs are filters, not sort orders: route them to the
        // `topic-types` param so the backend applies a tax_query (sortBy only
        // controls newest/oldest ordering).
        prev.set('topic-types', value)
      }

      return prev
    })
  }

  const topicTypes = useTaxonomiesStoreSelect()?.['bit-connect-topic-types'] || []
  const options = useMemo(
    () => [
      { label: __('Newest'), value: 'newest' },
      { label: __('Oldest'), value: 'oldest' },
      ...topicTypes.map(topic => ({
        label: topic.name,
        value: topic.slug
      })),
      // The Private filter is dropped with the feature: without it the option
      // is a filter that can only ever come back empty, since no new private
      // topic can be created. It stays while the visitor is actually looking at
      // that filter, so an existing bookmark does not land on a Select with a
      // value it cannot show.
      ...(isLoggedIn && (topicAccess?.privateTopic || currentValue === 'private')
        ? [{ label: __('Private'), value: 'private' }]
        : []),
      ...(isLoggedIn ? [{ label: __('My Topics'), value: 'my_topics' }] : [])
    ],
    [topicTypes, isLoggedIn, topicAccess?.privateTopic, currentValue]
  )

  const screens = Grid.useBreakpoint()
  const isMobile = !screens.sm

  return (
    <Select
      className="field-sizing-content topics-filter-select"
      labelRender={({ label }) => (
        <span className={isMobile ? 'bc-font-semibold bc-text-primary' : ''}>{label}</span>
      )}
      loading={loading}
      onChange={handleChange}
      options={options}
      popupMatchSelectWidth={false}
      size={isMobile ? 'middle' : 'large'}
      value={currentValue}
      variant={isMobile ? 'borderless' : 'filled'}
    />
  )
}
