import { __ } from '@common/helpers/i18nWrap'
import { Select } from 'antd'

import { type EmailDeliverySectionProps } from '../shared/types'
import SectionCard from './section-card'

const HOURS = Array.from({ length: 24 }, (_, hour) => ({
  label: `${String(hour).padStart(2, '0')}:00`,
  value: hour
}))

/**
 * When digests go out — a free section, with no sibling and no upsell.
 *
 * Digests are this plugin's own feature: members pick their cadence through
 * the portal, and the hourly cron in NotificationDigest batches and sends for
 * them. These controls set the default for members who have not chosen, and
 * nothing about them is conditional.
 */
export default function DigestScheduleSection({
  enabled,
  form,
  payload,
  set
}: EmailDeliverySectionProps) {
  return (
    <SectionCard
      subtitle={__('When batched email goes out, for members who have not chosen for themselves.')}
      title={__('Digest schedule')}
    >
      <div className="bc-grid bc-gap-4 sm:bc-grid-cols-2">
        <label className="bc-block">
          <span className="bc-mb-1 bc-block bc-text-sm bc-font-medium bc-text-ink">
            {__('Default email frequency')}
          </span>
          <Select
            className="bc-w-full"
            disabled={!enabled}
            onChange={value => set('defaultFrequency', value)}
            options={payload.frequencies.map(value => ({ label: value, value }))}
            value={form.defaultFrequency}
          />
        </label>
        <label className="bc-block">
          <span className="bc-mb-1 bc-block bc-text-sm bc-font-medium bc-text-ink">
            {__('Digest send hour')}
          </span>
          <Select
            className="bc-w-full"
            disabled={!enabled}
            onChange={value => set('digestHour', value)}
            options={HOURS}
            value={form.digestHour}
          />
        </label>
      </div>
    </SectionCard>
  )
}
