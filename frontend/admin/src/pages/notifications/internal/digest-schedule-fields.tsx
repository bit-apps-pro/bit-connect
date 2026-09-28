import { __ } from '@common/helpers/i18nWrap'
import { Button, Select } from 'antd'

import { type NotificationSettingsData, type SetNotificationField } from '../shared/types'
import FieldLabel from './field-label'

const HOURS = Array.from({ length: 24 }, (_, hour) => ({
  label: `${String(hour).padStart(2, '0')}:00`,
  value: hour
}))

/** The server sends the values; the words for them live here. */
const frequencyLabel = (value: string) =>
  ({
    daily: __('Daily'),
    instant: __('Instant'),
    never: __('Never'),
    weekly: __('Weekly')
  })[value] ?? value.charAt(0).toUpperCase() + value.slice(1)

interface DigestScheduleFieldsProps {
  enabled: boolean
  form: NotificationSettingsData
  frequencies: string[]
  set: SetNotificationField
}

/**
 * When digests go out — free fields, with no sibling and no upsell.
 *
 * Digests are this plugin's own feature: members pick their cadence through
 * the portal, and the hourly cron in NotificationDigest batches and sends for
 * them. These controls set the default for members who have not chosen, and
 * nothing about them is conditional. They sit inside the Email delivery card,
 * both editions of which render this same module, and save with the page.
 */
export default function DigestScheduleFields({
  enabled,
  form,
  frequencies,
  set
}: DigestScheduleFieldsProps) {
  return (
    <div className="bc-grid bc-gap-4 sm:bc-grid-cols-2">
      <div>
        <FieldLabel>{__('Default email frequency')}</FieldLabel>
        <div className="bc-flex bc-flex-wrap bc-gap-2" role="radiogroup">
          {frequencies.map(value => {
            const isActive = form.defaultFrequency === value

            return (
              <Button
                aria-checked={isActive}
                color={isActive ? 'primary' : 'default'}
                disabled={!enabled}
                key={value}
                onClick={() => set('defaultFrequency', value)}
                role="radio"
                size="large"
                variant="outlined"
              >
                {frequencyLabel(value)}
              </Button>
            )
          })}
        </div>
      </div>
      <label className="bc-block">
        <FieldLabel>{__('Digest send hour')}</FieldLabel>
        <Select
          className="bc-w-full"
          disabled={!enabled}
          onChange={value => set('digestHour', value)}
          options={HOURS}
          size="large"
          value={form.digestHour}
        />
      </label>
    </div>
  )
}
