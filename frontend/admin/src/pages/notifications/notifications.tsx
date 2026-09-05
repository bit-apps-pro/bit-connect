import { __ } from '@common/helpers/i18nWrap'
import { Alert, Button, InputNumber, Skeleton, Switch, Tooltip, Typography } from 'antd'
import { useEffect, useState } from 'react'
import { LuLock } from 'react-icons/lu'

import {
  useNotificationSettings,
  useSendTestEmail,
  useUpdateNotificationSettings
} from './data/use-notification-settings'
import EmailDeliverySection from './internal/email-delivery-section'
import EmailWordingSection from './internal/email-wording-section'
import SectionCard from './internal/section-card'
import { type NotificationSettingsData } from './shared/types'

const { Title } = Typography

/**
 * Forum-wide notification settings.
 *
 * Behind a single Save, unlike the member's own screen. These values are read
 * by cron jobs and by every dispatch, and an admin part-way through changing a
 * matrix should not have half of it live — the member's screen saves per switch
 * because each row there is independent and affects only them.
 */
export default function NotificationSettingsPage() {
  const { isSettingsError, isSettingsPending, payload } = useNotificationSettings()
  const { isUpdatingSettings, updateSettings } = useUpdateNotificationSettings()
  const { isSendingTest, sendTestEmail } = useSendTestEmail()

  const [form, setForm] = useState<NotificationSettingsData>()

  useEffect(() => {
    if (payload?.settings) setForm({ ...payload.settings, types: { ...payload.settings.types } })
  }, [payload])

  if (isSettingsPending) return <Skeleton active className="bc-p-5" paragraph={{ rows: 10 }} title />

  if (isSettingsError || !payload || !form) {
    return (
      <div className="bc-p-5">
        <Alert message={__('Notification settings could not be loaded.')} type="error" />
      </div>
    )
  }

  const set = <K extends keyof NotificationSettingsData>(key: K, value: NotificationSettingsData[K]) =>
    setForm(prev => (prev ? { ...prev, [key]: value } : prev))

  const setType = (type: string, patch: Partial<NotificationSettingsData['types'][string]>) =>
    setForm(prev =>
      prev ? { ...prev, types: { ...prev.types, [type]: { ...prev.types[type], ...patch } } } : prev
    )

  const { enabled } = form

  return (
    <div>
      <div className="bc-flex bc-items-center bc-justify-between bc-gap-3 bc-px-5 bc-py-6">
        <Title className="bc-mb-0" level={2}>
          {__('Notifications')}
        </Title>
        <Button
          disabled={isUpdatingSettings}
          loading={isUpdatingSettings}
          onClick={() => {
            updateSettings(form).catch(() => {
              // Reported by the hook; nothing useful to add here.
            })
          }}
          type="primary"
        >
          {__('Save')}
        </Button>
      </div>

      <div className="bc-flex bc-flex-col bc-gap-4 bc-px-5 bc-pb-8">
        <SectionCard
          subtitle={__(
            'The master switch. Off, the forum writes no notifications and sends no email at all.'
          )}
          title={__('Notifications')}
        >
          <div className="bc-flex bc-items-center bc-gap-3">
            <Switch checked={enabled} onChange={next => set('enabled', next)} />
            <span className="bc-text-sm bc-text-ink-muted">
              {enabled ? __('Notifications are on') : __('Notifications are off for everyone')}
            </span>
          </div>
        </SectionCard>

        <SectionCard
          subtitle={__(
            'Defaults apply to members who have never opened their own settings. Turn off "Member may change" to make your answer final for everyone.'
          )}
          title={__('What the forum sends')}
        >
          <div className="bc-overflow-x-auto">
            <table className="bc-w-full bc-min-w-[34rem] bc-border-collapse bc-text-sm">
              <thead>
                <tr className="bc-text-left bc-text-xs bc-text-ink-subtle">
                  <th className="bc-py-2 bc-font-medium">{__('Notification')}</th>
                  <th className="bc-w-24 bc-py-2 bc-text-center bc-font-medium">{__('In app')}</th>
                  <th className="bc-w-24 bc-py-2 bc-text-center bc-font-medium">{__('Email')}</th>
                  <th className="bc-w-36 bc-py-2 bc-text-center bc-font-medium">
                    {__('Member may change')}
                  </th>
                </tr>
              </thead>
              <tbody>
                {payload.catalog.map(info => {
                  const row = form.types[info.type]

                  if (!row) return

                  return (
                    <tr
                      className="bc-border-0 bc-border-t bc-border-solid bc-border-t-line"
                      key={info.type}
                    >
                      <td className="bc-py-3 bc-pe-4">
                        <div className="bc-font-medium bc-text-ink">{info.label}</div>
                        <div className="bc-text-xs bc-text-ink-subtle">{info.description}</div>
                      </td>
                      <td className="bc-py-3 bc-text-center">
                        {/* Locked where the forum sends it regardless — an
                            admin switch that changes nothing is worse than no
                            switch at all. */}
                        <Tooltip
                          title={
                            info.mandatoryInApp ? __('This is always delivered in the app.') : undefined
                          }
                        >
                          <span className="bc-inline-flex bc-items-center bc-gap-1">
                            <Switch
                              checked={info.mandatoryInApp || row.inapp}
                              disabled={!enabled || info.mandatoryInApp}
                              onChange={next => setType(info.type, { inapp: next })}
                              size="small"
                            />
                            {info.mandatoryInApp && <LuLock className="bc-text-ink-subtle" size={12} />}
                          </span>
                        </Tooltip>
                      </td>
                      <td className="bc-py-3 bc-text-center">
                        <Switch
                          checked={row.email}
                          disabled={!enabled}
                          onChange={next => setType(info.type, { email: next })}
                          size="small"
                        />
                      </td>
                      <td className="bc-py-3 bc-text-center">
                        <Tooltip
                          title={
                            info.moderatorOnly
                              ? __(
                                  'Only moderators receive this, so there is nothing for a member to change.'
                                )
                              : undefined
                          }
                        >
                          <Switch
                            checked={row.userMayOverride}
                            disabled={!enabled || info.moderatorOnly}
                            onChange={next => setType(info.type, { userMayOverride: next })}
                            size="small"
                          />
                        </Tooltip>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
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
          title={__('Housekeeping')}
        >
          <label className="bc-block bc-max-w-xs">
            <span className="bc-mb-1 bc-block bc-text-sm bc-font-medium bc-text-ink">
              {__('Keep read notifications for')}
            </span>
            <InputNumber
              addonAfter={__('days')}
              className="bc-w-full"
              max={3650}
              min={7}
              onChange={value => set('retentionDays', Number(value ?? 90))}
              value={form.retentionDays}
            />
          </label>
        </SectionCard>
      </div>
    </div>
  )
}
