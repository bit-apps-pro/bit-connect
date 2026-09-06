import { __, sprintf } from '@common/helpers/i18nWrap'
import { Button, Divider, Grid, Select } from 'antd'
import { useMemo } from 'react'
import { useSearchParams } from 'react-router'

import { useTaxonomiesStoreSelect } from '@/store/use-taxonomies-store'

/** Query param holding the selected tag slugs. */
const TAGS_PARAM = 'tags'

/**
 * Selected tag slugs from a raw query-string value.
 *
 * The backend ORs a comma separated slug list (`tax_query` with `operator =>
 * 'IN'`), so that is the wire format. Blank segments and repeats are dropped so
 * `?tags=a,,a` and `?tags=a` describe the same filter — otherwise the topics
 * list would see two different filter keys and refetch for nothing.
 */
export const parseTagParam = (value: null | string): string[] => [
  ...new Set(
    (value ?? '')
      .split(',')
      .map(slug => slug.trim())
      .filter(Boolean)
  )
]

/** Display form of a tag name, matching how topic cards render them. */
export const tagLabel = (name: string) => `#${name.replaceAll(' ', '_')}`

interface TagOption {
  count: number
  label: string
  name: string
  value: string
}

/**
 * Multi-select tag filter for the topics list.
 *
 * Tags differ from the Sort and Product filters in that several can apply at
 * once, so this is a multiple Select rather than a single one. It keeps their
 * pill treatment so the toolbar still reads as one control bar, and collapses
 * selections to "+N" instead of growing, which would push the row around every
 * time a tag is picked.
 */
export default function TagFilter({ loading = false }: { loading?: boolean }) {
  const [searchParams, setSearchParams] = useSearchParams()
  const selected = useMemo(() => parseTagParam(searchParams.get(TAGS_PARAM)), [searchParams])

  const handleChange = (slugs: string[]) => {
    setSearchParams(prev => {
      if (prev.has('page')) {
        prev.set('page', '1')
      }

      if (slugs.length === 0) {
        prev.delete(TAGS_PARAM)
      } else {
        prev.set(TAGS_PARAM, slugs.join(','))
      }

      return prev
    })
  }

  const taxonomies = useTaxonomiesStoreSelect()

  const options = useMemo<TagOption[]>(() => {
    // Read inside the memo: the `|| []` fallback would otherwise be a fresh
    // array on every render and defeat the memo entirely before taxonomies
    // have loaded.
    const tags = taxonomies?.['bit-connect-tags'] || []

    // An unused tag can only ever return an empty list, so keep it out of the
    // menu — unless it is already applied via the URL, where it has to stay
    // present to be removable.
    const known = tags
      .filter(tag => tag.count > 0 || selected.includes(tag.slug))
      // Most-used first: with a search box available, frequency is more useful
      // than alphabetical for deciding what is worth filtering on.
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
      .map(tag => ({ count: tag.count, label: tagLabel(tag.name), name: tag.name, value: tag.slug }))

    // A slug in the URL that matches no term at all (stale link, hand-edited
    // URL). Surface it rather than dropping it silently, so the empty result
    // has a visible cause the reader can clear.
    const orphans = selected
      .filter(slug => !tags.some(tag => tag.slug === slug))
      .map(slug => ({ count: 0, label: tagLabel(slug), name: slug, value: slug }))

    return [...known, ...orphans]
  }, [taxonomies, selected])

  const screens = Grid.useBreakpoint()
  const isMobile = !screens.sm

  return (
    <Select<string[], TagOption>
      allowClear
      aria-label={__('Filter by tag')}
      className="topics-filter-select topics-tag-select"
      dropdownRender={menu => (
        <>
          {menu}
          {selected.length > 0 && (
            <>
              <Divider className="bc-my-1" />
              <div className="bc-flex bc-items-center bc-justify-between bc-gap-2 bc-pl-3 bc-pr-1">
                <span className="bc-text-xs bc-text-ink-subtle">
                  {sprintf(__('%s selected'), String(selected.length))}
                </span>
                <Button onClick={() => handleChange([])} size="small" type="link">
                  {__('Clear')}
                </Button>
              </div>
            </>
          )}
        </>
      )}
      filterOption={(input, option) => {
        const query = input.trim().toLowerCase()
        if (query === '') return true
        // Match the human name as well as the slug, so "new feature" finds a
        // tag the label renders as "#new_feature".
        return (
          (option?.name.toLowerCase().includes(query) ?? false) ||
          (option?.value.toLowerCase().includes(query) ?? false)
        )
      }}
      loading={loading}
      // Collapse extra selections into "+N" rather than letting the control
      // grow — needs the fixed width below to have something to measure.
      maxTagCount="responsive"
      mode="multiple"
      onChange={handleChange}
      optionRender={option => (
        <div className="bc-flex bc-items-center bc-justify-between bc-gap-3">
          <span className="bc-truncate">{option.data.label}</span>
          <span className="bc-shrink-0 bc-text-xs bc-text-ink-subtle">{option.data.count}</span>
        </div>
      )}
      options={options}
      placeholder={__('Tags')}
      popupMatchSelectWidth={240}
      size={isMobile ? 'middle' : 'large'}
      style={{ width: isMobile ? 190 : 200 }}
      value={selected}
      variant={isMobile ? 'borderless' : 'filled'}
    />
  )
}
