import { __ } from '@common/helpers/i18nWrap'
import { Radio, Switch, Typography } from 'antd'
import { motion } from 'framer-motion'
import { useMemo } from 'react'

import { type GeneralSettings, type PortalAccess, type PortalFilters } from '../shared/types'
import ChoiceCard from './choice-card'
import SectionCard from './section-card'
import SettingRow from './setting-row'

const { Text } = Typography

interface AccessSectionProps {
  disabled: boolean
  form: GeneralSettings
  onPatch: (values: Partial<GeneralSettings>) => void
  onPatchFilter: (key: keyof PortalFilters, visible: boolean) => void
}

/** Who gets in, and how much of the topic list they can slice up once inside. */
export default function AccessSection({ disabled, form, onPatch, onPatchFilter }: AccessSectionProps) {
  // Built here rather than at module scope: the strings are translated when
  // this renders, and WordPress loads the translations after the bundle.
  const filters = useMemo(
    () =>
      [
        {
          description: __('Newest, oldest, most active — how the topic list is ordered.'),
          key: 'sort',
          label: __('Sort')
        },
        {
          description: __('Narrow the list down to one product or department.'),
          key: 'product',
          label: __('Product')
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
    <>
      <SectionCard subtitle={__('Who can read the portal.')} title={__('Access')}>
        <SettingRow full label={__('Who can see the portal')}>
          <Radio.Group
            className="bc-w-full"
            disabled={disabled}
            onChange={e => onPatch({ portalAccess: e.target.value as PortalAccess })}
            value={form.portalAccess}
          >
            <div className="bc-grid bc-gap-3 md:bc-grid-cols-2">
              <ChoiceCard
                description={__(
                  'Anyone can read topics, and search engines can index them. Posting still needs an account.'
                )}
                groupId="portal-access"
                label={__('Everyone')}
                selected={form.portalAccess === 'everyone'}
                value="everyone"
              />
              <ChoiceCard
                description={__(
                  'Visitors are sent to sign in first. Nothing in the portal is publicly readable or indexable.'
                )}
                groupId="portal-access"
                label={__('Logged-in users only')}
                selected={form.portalAccess === 'logged_in'}
                value="logged_in"
              />
            </div>
          </Radio.Group>
        </SettingRow>
      </SectionCard>

      <SectionCard
        subtitle={__(
          'The controls above the topic list. A hidden filter still applies when its value is in the URL, so links people have already shared keep working.'
        )}
        title={__('Topic list filters')}
      >
        <SettingRow full label={__('Filters visitors can use')}>
          <div className="bc-grid bc-gap-4 md:bc-grid-cols-3">
            {filters.map(filter => (
              // A hidden filter reads as switched off from across the row, not
              // only at the switch: the card itself steps back.
              <motion.div
                animate={{ opacity: form.portalFilters[filter.key] ? 1 : 0.55 }}
                className="bc-flex bc-flex-col bc-justify-between bc-gap-3 bc-rounded-md bc-border bc-border-solid bc-border-line bc-p-4"
                key={filter.key}
                transition={{ duration: 0.2 }}
              >
                <div className="bc-flex bc-items-center bc-justify-between bc-gap-2">
                  <Text strong>{filter.label}</Text>
                  <Switch
                    checked={form.portalFilters[filter.key]}
                    disabled={disabled}
                    onChange={checked => onPatchFilter(filter.key, checked)}
                  />
                </div>
                <Text className="bc-text-sm" type="secondary">
                  {filter.description}
                </Text>
              </motion.div>
            ))}
          </div>
        </SettingRow>
      </SectionCard>
    </>
  )
}
