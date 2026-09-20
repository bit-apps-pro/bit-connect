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
 * These two controls used to sit in the delivery section behind the add-on,
 * and the frequency one was written to an option the server then overrode
 * unless a licence answered. That was wrong twice over: it is a built-in
 * feature switched off by a licence test, which WordPress.org guideline 5
 * forbids, and it was not withholding anything real — members have always
 * picked their own cadence through the portal, and the hourly cron in
 * NotificationDigest has always batched and sent for them. The only thing the
 * gate achieved was making the admin's *default* silently not apply.
 *
 * So it moved here, out of the delivery card, where nothing is conditional.
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
