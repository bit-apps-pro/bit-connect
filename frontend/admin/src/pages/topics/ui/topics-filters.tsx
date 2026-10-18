import { __ } from '@common/helpers/i18nWrap'
import { Button, Input, Select } from 'antd'
import { useEffect, useState } from 'react'
import { LuSearch, LuX } from 'react-icons/lu'

import useAuthorSearch from '../data/use-author-search'
import { type FilterTaxonomy, type TopicFilters } from '../shared/types'
import TermSelect, { type TermOption } from './term-select'

interface TopicsFiltersProps {
  filters: TopicFilters
  isFiltered: boolean
  onChange: (patch: Partial<TopicFilters>) => void
  onClear: () => void
  stages: TermOption[]
  statuses: TermOption[]
  taxonomies: FilterTaxonomy[]
  topicTypes: TermOption[]
}

export default function TopicsFilters({
  filters,
  isFiltered,
  onChange,
  onClear,
  stages,
  statuses,
  taxonomies,
  topicTypes
}: TopicsFiltersProps) {
  // Typed into here and sent a moment later, so a word is one request rather
  // than one per keystroke.
  const [search, setSearch] = useState(filters.search ?? '')
  const [authorTerm, setAuthorTerm] = useState('')
  const [authorName, setAuthorName] = useState('')
  const { authors, isSearching } = useAuthorSearch(authorTerm)

  useEffect(() => {
    if ((filters.search ?? '') === search.trim()) return
    const timer = setTimeout(() => onChange({ search: search.trim() || undefined }), 350)
    return () => clearTimeout(timer)
  }, [search, filters.search, onChange])

  // Cleared from outside — the Clear button — empties the box too.
  useEffect(() => {
    if (filters.search === undefined) setSearch('')
    if (filters.author_id === undefined) setAuthorName('')
  }, [filters.search, filters.author_id])

  return (
    <div className="bc-mb-4 bc-flex bc-flex-wrap bc-items-center bc-gap-3 bc-rounded-lg bc-border bc-border-solid bc-border-line bc-bg-surface bc-px-5 bc-py-4">
      <Input
        allowClear
        className="bc-w-[240px] bc-max-w-full"
        onChange={event => setSearch(event.target.value)}
        placeholder={__('Search posts')}
        prefix={<LuSearch aria-hidden className="bc-text-ink-subtle" />}
        value={search}
      />
      <TermSelect
        allowClear
        className="bc-min-w-[150px]"
        onChange={status => onChange({ status })}
        placeholder={__('Any status')}
        terms={statuses}
        value={filters.status}
      />
      <TermSelect
        allowClear
        className="bc-min-w-[150px]"
        onChange={stage => onChange({ stage })}
        placeholder={__('Any stage')}
        terms={stages}
        value={filters.stage}
      />
      <TermSelect
        allowClear
        className="bc-min-w-[150px]"
        onChange={topicType => onChange({ topic_type: topicType })}
        placeholder={__('Any category')}
        terms={topicTypes}
        value={filters.topic_type}
      />
      {taxonomies.map(taxonomy => (
        <TermSelect
          allowClear
          className="bc-min-w-[150px]"
          key={taxonomy.param}
          onChange={id => onChange({ terms: { ...filters.terms, [taxonomy.param]: id } })}
          placeholder={taxonomy.label}
          terms={taxonomy.terms}
          value={filters.terms?.[taxonomy.param]}
        />
      ))}
      <Select
        allowClear
        className="bc-min-w-[140px]"
        onChange={visibility => onChange({ visibility })}
        options={[
          { label: __('Public'), value: 'public' },
          { label: __('Private'), value: 'private' },
          { label: __('Hidden'), value: 'hidden' }
        ]}
        placeholder={__('Any visibility')}
        value={filters.visibility}
      />
      <Select
        allowClear
        className="bc-min-w-[180px]"
        filterOption={false}
        loading={isSearching}
        notFoundContent={authorTerm.trim() === '' ? __('Type a name') : __('No members found')}
        onChange={(author: number | undefined, option) => {
          setAuthorName(author && !Array.isArray(option) ? String(option?.label ?? '') : '')
          onChange({ author_id: author })
        }}
        onSearch={setAuthorTerm}
        options={authors.map(author => ({ label: author.name, value: author.id }))}
        placeholder={__('Any author')}
        showSearch
        value={filters.author_id}
        {...(filters.author_id && authorName ? { labelRender: () => authorName } : {})}
      />

      {isFiltered && (
        <Button className="bc-ml-auto" icon={<LuX aria-hidden />} onClick={onClear} size="small" type="text">
          {__('Clear')}
        </Button>
      )}
    </div>
  )
}
