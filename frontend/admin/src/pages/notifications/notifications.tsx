import { __ } from '@common/helpers/i18nWrap'
import { combineSaves, flushAll, PageSaveContext, usePageSaves } from '@common/hooks/page-save'
import useAutoSave from '@common/hooks/use-auto-save'
import SaveStatus from '@utilities/save-status'
import { Alert, Button, InputNumber, Switch, Typography } from 'antd'
import { useState } from 'react'

import {
  useNotificationSettings,
  useSendTestEmail,
  useUpdateNotificationSettings
} from './data/use-notification-settings'
import EmailDeliverySection from './internal/email-delivery-section'
import EmailWordingSection from './internal/email-wording-section'
import PageSkeleton from './internal/page-skeleton'
import SectionCard from './internal/section-card'
import TypeMatrix from './internal/type-matrix'
import { type NotificationSettingsData } from './shared/types'

const { Title } = Typography

/**
 * Forum-wide notification settings.
 *
 * Saved as they change, like every settings screen. Changes made in quick
 * succession — several switches across the matrix — go out as one save, and
 * the status line beside the master switch covers the cards the add-on adds.
 */
export default function NotificationSettingsPage() {
  const { isSettingsError, isSettingsPending, payload, refetchSettings } = useNotificationSettings()
  const { updateSettings } = useUpdateNotificationSettings()
  const { isSendingTest, sendTestEmail } = useSendTestEmail()

  const [form, setForm] = useState<NotificationSettingsData>()
  const { report, states } = usePageSaves()

  const save = useAutoSave({
    draft: form,
    save: updateSettings,
    saved: payload?.settings,
    setDraft: setForm
  })
  const allSaves = [{ ...save, flush: save.flushNow }, ...states]
  const pageSave = combineSaves(allSaves)
  // Leaving any field saves at once, rather than waiting out the delay.
  const saveAll = () => flushAll(allSaves)

  // An error only once every retry has failed and there is nothing to show.
  if (isSettingsError && !payload) {
    return (
      <div className="bc-p-6">
        <Alert
          action={
            <Button onClick={() => refetchSettings()} size="small">
              {__('Retry')}
            </Button>
          }
          message={__('Notification settings could not be loaded.')}
          showIcon
          type="error"
        />
      </div>
    )
  }

  // Still loading, or loaded and not yet copied into the form — the render
  // between the two is not a failure.
  if (isSettingsPending || !payload || !form) return <PageSkeleton />


  const set = <K extends keyof NotificationSettingsData>(key: K, value: NotificationSettingsData[K]) =>
    setForm(prev => (prev ? { ...prev, [key]: value } : prev))

  const setType = (type: string, patch: Partial<NotificationSettingsData['types'][string]>) =>
    setForm(prev =>
      prev ? { ...prev, types: { ...prev.types, [type]: { ...prev.types[type], ...patch } } } : prev
    )

  const { enabled } = form

  return (
    <PageSaveContext.Provider value={report}>
    <div className="bc-p-6" onBlur={saveAll}>
      <div className="bc-mb-5">
        <Title className="bc-mb-0" level={3}>
          {__('Notifications')}
        </Title>
      </div>

      <div className="bc-flex bc-flex-col bc-gap-5">
        {/* The status sits beside the master switch rather than at the foot of
            the page: it speaks for every card below. */}
        <div className="bc-flex bc-flex-wrap bc-items-end bc-justify-between bc-gap-4">
          <SectionCard
            className="bc-w-full bc-max-w-xl"
            extra={
              <Switch
                aria-label={__('Notifications')}
                checked={enabled}
                onChange={next => set('enabled', next)}
              />
            }
            subtitle={
              enabled
                ? __('The master switch. Off, the forum writes no notifications and sends no email at all.')
                : __('Off for everyone. The forum writes no notifications and sends no email at all.')
            }
            title={__('Notifications')}
          />

          <SaveStatus {...pageSave} onRetry={saveAll} />
        </div>

        <SectionCard
          subtitle={__(
            'Defaults apply to members who have never opened their own settings. Turn off "Member may change" to make your answer final for everyone.'
          )}
          title={__('What the forum sends')}
        >
          <TypeMatrix
            catalog={payload.catalog}
            enabled={enabled}
            onChange={setType}
            types={form.types}
          />
        </SectionCard>

        <EmailDeliverySection
          enabled={enabled}
          form={form}
          isSendingTest={isSendingTest}
          payload={payload}
          sendTestEmail={sendTestEmail}
          set={set}
        />

        <EmailWordingSection enabled={enabled} form={form} payload={payload} set={set} />

        <SectionCard
          subtitle={__(
            'How long read notifications are kept. Unread ones are never removed by age, since nobody has seen them yet.'
          )}
          title={__('Keep read notifications for')}
        >
          <label className="bc-flex bc-items-center bc-gap-3">
            <InputNumber
              aria-label={__('Keep read notifications for')}
              className="bc-w-24"
              max={3650}
              min={7}
              onChange={value => set('retentionDays', Number(value ?? 90))}
              size="large"
              value={form.retentionDays}
            />
            <span className="bc-text-sm bc-text-ink">{__('days')}</span>
          </label>
        </SectionCard>
      </div>
    </div>
    </PageSaveContext.Provider>
  )
}
