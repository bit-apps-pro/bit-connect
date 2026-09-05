import { type NotificationSettingsData, type NotificationSettingsPayload } from '../shared/types'

/**
 * Placeholder — the Bit Connect Pro add-on is not part of this repository.
 *
 * `IS_PRO_ACTIVE` is a compile-time `false` in this build, so the dispatch in
 * `email-delivery-section.tsx` never renders this component and Rollup drops it
 * from the bundle. The module exists only so the import graph resolves and the
 * types below stay available to `email-delivery-section.free.tsx` and
 * `email-wording-section.free.tsx`, which import them.
 */

/** Patches one top-level field of the settings form. */
export type SetNotificationField = <K extends keyof NotificationSettingsData>(
  key: K,
  value: NotificationSettingsData[K]
) => void

export interface EmailDeliverySectionProps {
  enabled: boolean
  form: NotificationSettingsData
  isSendingTest: boolean
  payload: NotificationSettingsPayload
  sendTestEmail: () => Promise<unknown>
  set: SetNotificationField
}

export default function EmailDeliverySectionPro(_props: EmailDeliverySectionProps) {
  return null
}
