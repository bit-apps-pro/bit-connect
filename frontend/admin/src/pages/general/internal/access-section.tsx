import { __, sprintf } from '@common/helpers/i18nWrap'
import config from '@config/config'
import { Switch, Typography } from 'antd'
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
          description: sprintf(__('Narrow the list down to one %s.'), config.DEPARTMENT_NAMING.singular),
          key: 'product',
          label: config.DEPARTMENT_NAMING.singular
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
      <SectionCard
        subtitle={__('Choose whether your community is open to everyone or only to members.')}
        title={__('Access')}
      >
        <SettingRow
          description={__('Decide whether visitors can read topics without signing in.')}
          full
          label={__('Who can see the portal')}
        >
          <div
            aria-label={__('Who can see the portal')}
            className="bc-flex bc-flex-wrap bc-gap-3"
            role="radiogroup"
          >
            <ChoiceCard
              checked={form.portalAccess === 'everyone'}
              description={__(
                'Anyone can read topics, and search engines can index them. Posting still needs an account.'
              )}
              disabled={disabled}
              label={__('Everyone')}
              name="portal-access"
              onSelect={value => onPatch({ portalAccess: value as PortalAccess })}
              value="everyone"
            />
            <ChoiceCard
              checked={form.portalAccess === 'logged_in'}
              description={__(
                'Visitors are sent to sign in first. Nothing in the portal is publicly readable or indexable.'
              )}
              disabled={disabled}
              label={__('Logged-in users only')}
              name="portal-access"
              onSelect={value => onPatch({ portalAccess: value as PortalAccess })}
              value="logged_in"
            />
          </div>
        </SettingRow>
      </SectionCard>

      <SectionCard
        subtitle={__(
          'Pick which filters visitors see above the topic list. Hiding one won’t break links people have already shared.'
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
    </>
  )
}
