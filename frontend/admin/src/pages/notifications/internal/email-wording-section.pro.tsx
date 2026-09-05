import { type NotificationSettingsData, type NotificationSettingsPayload } from '../shared/types'
import { type SetNotificationField } from './email-delivery-section.pro'

/**
 * Placeholder — the Bit Connect Pro add-on is not part of this repository.
 *
 * `IS_PRO_ACTIVE` is a compile-time `false` in this build, so the dispatch in
 * `email-wording-section.tsx` never renders this component and Rollup drops it
 * from the bundle. The module exists only so the import graph resolves and the
 * props type below stays available to `email-wording-section.free.tsx`, which
 * imports it.
 */
export interface EmailWordingSectionProps {
  enabled: boolean
  form: NotificationSettingsData
  payload: NotificationSettingsPayload
  set: SetNotificationField
}

export default function EmailWordingSectionPro(_props: EmailWordingSectionProps) {
  return null
}
