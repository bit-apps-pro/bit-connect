import { __ } from '@common/helpers/i18nWrap'
import { Switch, Typography } from 'antd'
import { motion } from 'framer-motion'
import { useMemo } from 'react'

import { type GeneralSettings, type PortalFilters } from '../shared/types'
import SectionCard from './section-card'
import SettingRow from './setting-row'

const { Text } = Typography

interface TopicListFiltersSectionProps {
  disabled: boolean
  form: GeneralSettings
  onPatchFilter: (key: keyof PortalFilters, visible: boolean) => void
}

/**
 * Which controls sit over the portal's topic list. How the list looks, not who
 * may read it, so it sits with the portal's appearance rather than with Access.
 */
export default function TopicListFiltersSection({ disabled, form, onPatchFilter }: TopicListFiltersSectionProps) {
  // Built here rather than at module scope: the strings are translated when
  // this renders, and WordPress loads the translations after the bundle.
  const filters = useMemo(
    () =>
      [
        {
          description: __('How the topic list is sorted: newest, oldest or most active.'),
          key: 'sort',
          label: __('Sort')
        },
        {
          description: __('A row of chips over the list, one per topic type.'),
          key: 'types',
          label: __('Topic types')
        },
        {
          description: __('Narrow the list down to a tag.'),
          key: 'tags',
          label: __('Tags')
        }
      ] satisfies { description: string; key: keyof PortalFilters; label: string }[],
    []
  )

  return (
    <SectionCard
      subtitle={__(
        'Select the filters that visitors can use to narrow the topic list. Links that people already shared continue to work when you hide a filter.'
      )}
      title={__('Topic list filters')}
    >
      <SettingRow full label={__('Filters visitors can use')}>
        <div className="bc-flex bc-flex-wrap bc-gap-3">
          {filters.map(filter => (
            // A hidden filter reads as switched off from across the row, not
            // only at the switch: the card itself steps back.
            <motion.div
              animate={{ opacity: form.portalFilters[filter.key] ? 1 : 0.55 }}
              className="bc-flex bc-w-44 bc-max-w-full bc-flex-col bc-gap-2 bc-rounded-md bc-border bc-border-solid bc-border-line bc-bg-surface bc-p-3"
              key={filter.key}
              transition={{ duration: 0.2 }}
            >
              <div className="bc-flex bc-items-center bc-justify-between bc-gap-2">
                <Text className="bc-text-sm" strong>
                  {filter.label}
                </Text>
                <Switch
                  aria-label={filter.label}
                  checked={form.portalFilters[filter.key]}
                  disabled={disabled}
                  onChange={checked => onPatchFilter(filter.key, checked)}
                  size="small"
                />
              </div>
              <Text className="bc-text-xs" type="secondary">
                {filter.description}
              </Text>
            </motion.div>
          ))}
        </div>
      </SettingRow>
    </SectionCard>
  )
}
