import { __ } from '@common/helpers/i18nWrap'
import { PageSaveContext, type SaveParticipant } from '@common/hooks/page-save'
import { Alert, Button, InputNumber, Switch, Typography } from 'antd'
import { useCallback, useEffect, useMemo, useState } from 'react'

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

const { Text, Title } = Typography

/**
 * Forum-wide notification settings.
 *
 * Behind a single Save, unlike the member's own screen. These values are read
 * by cron jobs and by every dispatch, and an admin part-way through changing a
 * matrix should not have half of it live — the member's screen saves per switch
 * because each row there is independent and affects only them.
 */
export default function NotificationSettingsPage() {
  const { isSettingsError, isSettingsPending, payload, refetchSettings } = useNotificationSettings()
  const { isUpdatingSettings, updateSettings } = useUpdateNotificationSettings()
  const { isSendingTest, sendTestEmail } = useSendTestEmail()

  const [form, setForm] = useState<NotificationSettingsData>()
  const [participants, setParticipants] = useState<Record<string, SaveParticipant>>({})
  const [isSaving, setIsSaving] = useState(false)

  const reportParticipant = useCallback((key: string, participant?: SaveParticipant) => {
    setParticipants(prev => {
      const rest = Object.fromEntries(Object.entries(prev).filter(([name]) => name !== key))
      return participant ? { ...rest, [key]: participant } : rest
    })
  }, [])

  useEffect(() => {
    if (payload?.settings) setForm({ ...payload.settings, types: { ...payload.settings.types } })
  }, [payload])

  const isFormDirty = useMemo(
    () => !!form && !!payload && JSON.stringify(form) !== JSON.stringify(payload.settings),
    [form, payload]
  )
  const dirtyParticipants = Object.values(participants).filter(participant => participant.isDirty)
  const isDirty = isFormDirty || dirtyParticipants.length > 0

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

  // Every part at once, each reporting its own failure: one card's rejected
  // value should not stop the rest of the page from saving.
  const save = async () => {
    setIsSaving(true)
    await Promise.allSettled([
      ...(isFormDirty ? [updateSettings(form)] : []),
      ...dirtyParticipants.map(participant => participant.save())
    ])
    setIsSaving(false)
  }

  return (
    <PageSaveContext.Provider value={reportParticipant}>
    <div className="bc-p-6">
      <div className="bc-mb-5">
        <Title className="bc-mb-1" level={3}>
          {__('Notifications')}
        </Title>
        <Text type="secondary">
          {__('What the forum tells members, in the app and by email, and how that email reads.')}
        </Text>
      </div>

      <div className="bc-flex bc-flex-col bc-gap-5">
        {/* Save sits beside the master switch rather than at the foot of the
            page: it governs every card below, and has to be in reach from the
            top of a long form. */}
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

          <div className="bc-flex bc-shrink-0 bc-items-center bc-gap-3">
            {isDirty && <Text type="secondary">{__('Unsaved changes')}</Text>}
            <Button
              disabled={isSaving || isUpdatingSettings || !isDirty}
              loading={isSaving || isUpdatingSettings}
              onClick={save}
              size="large"
              type="primary"
            >
              {__('Save')}
            </Button>
          </div>
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
            'How long read notifications are kept. Unread ones are never removed by age — nobody has seen them yet.'
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
