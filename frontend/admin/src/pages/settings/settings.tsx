import { __ } from '@common/helpers/i18nWrap'
import useAutoSave from '@common/hooks/use-auto-save'
import PageTabs, { type PageTab } from '@utilities/page-tabs'
import SaveStatus from '@utilities/save-status'
import { Typography } from 'antd'
import { type ReactNode, useCallback, useMemo, useState } from 'react'
import { LuDatabase, LuGauge, LuMessageSquare, LuShieldCheck } from 'react-icons/lu'

import useSettings from './data/use-settings'
import useUpdateSettings from './data/use-update-settings'
import ModerationSection from './internal/moderation-section'
import PostingLimitsSection from './internal/posting-limits-section'
import SettingsSection from './internal/settings-section'
import TopicAccessExtras from './internal/topic-access-extras'
import TopicFormSection from './internal/topic-form-section'
import {
  type CleanupSettings,
  type SettingsFormData,
  type TopicAccessSettings,
  type TopicFieldMode,
  type TopicFormFieldsSettings
} from './shared/types'

const { Title } = Typography

export default function Settings() {
  const { isSettingsPending, settings } = useSettings()
  const { updateSettings } = useUpdateSettings()

  const [form, setForm] = useState<SettingsFormData>()
  const [activeTab, setActiveTab] = useState('topics')

  // Saved as it changes: each switch here is a whole setting on its own. A
  // short delay, since there is nothing to type — only a quick run of flips
  // to gather into one request.
  const save = useAutoSave({
    delay: 300,
    draft: form,
    save: updateSettings,
    saved: isSettingsPending ? undefined : settings,
    setDraft: setForm
  })

  const handleSettingChange = useCallback(
    (
      section: 'cleanup' | 'topicAccess',
      key: keyof CleanupSettings | keyof TopicAccessSettings,
      value: boolean
    ) => {
      setForm(prev => {
        if (!prev) return prev
        const updated: SettingsFormData = {
          cleanup: { ...prev.cleanup },
          topicAccess: { ...prev.topicAccess },
          topicFormFields: { ...prev.topicFormFields }
        }
        if (section === 'topicAccess') {
          updated.topicAccess[key as keyof TopicAccessSettings] = value
        } else {
          updated.cleanup[key as keyof CleanupSettings] = value
        }
        return updated
      })
    },
    []
  )

  const handleFieldModeChange = useCallback((field: keyof TopicFormFieldsSettings, mode: TopicFieldMode) => {
    setForm(prev => prev && { ...prev, topicFormFields: { ...prev.topicFormFields, [field]: mode } })
  }, [])

  const topicAccessSettings = useMemo(() => {
    if (!form?.topicAccess) return []
    return [
      {
        description: __('Let members upvote topics.'),
        key: 'upvote',
        label: __('Upvotes'),
        value: form.topicAccess.upvote ?? false
      },
      {
        description: __('Let members reply to topics.'),
        key: 'comment',
        label: __('Comments'),
        value: form.topicAccess.comment ?? false
      },
      // Neither comment upvoting nor private topics is here, for the same
      // reason: both settings are the add-on's, stored in the add-on's
      // options and rendered by the add-on's own section, because the
      // features they switch are entirely over there. A switch here for
      // either would be a control with nothing behind it.
    ]
  }, [form])

  const cleanupSettings = useMemo(() => {
    if (!form?.cleanup) return []
    return [
      {
        description: __(
          'When the plugin is deleted, remove every topic and reply, its terms and settings, and the portal page. This can’t be undone.'
        ),
        key: 'deleteDataOnUninstall',
        label: __('Delete data on uninstall'),
        value: form.cleanup.deleteDataOnUninstall ?? false
      }
    ]
  }, [form])

  // Built once: PageTabs needs stable options, or a switch mid-slide cuts the
  // thumb's animation short.
  const tabs = useMemo<PageTab[]>(
    () => [
      { icon: <LuMessageSquare aria-hidden className="bc-shrink-0" size={16} />, key: 'topics', label: __('Topics') },
      { icon: <LuShieldCheck aria-hidden className="bc-shrink-0" size={16} />, key: 'moderation', label: __('Moderation') },
      { icon: <LuGauge aria-hidden className="bc-shrink-0" size={16} />, key: 'limits', label: __('Limits') },
      { icon: <LuDatabase aria-hidden className="bc-shrink-0" size={16} />, key: 'data', label: __('Data') }
    ],
    []
  )

  const panels: Record<string, ReactNode> = {
    data: (
      <SettingsSection
        disabled={!form}
        onChange={(key, value) => handleSettingChange('cleanup', key as keyof CleanupSettings, value)}
        settings={cleanupSettings}
        subtitle={__('Choose what happens to your community’s data if the plugin is deleted.')}
        title={__('Data cleanup')}
      />
    ),
    // Takes nothing from this form: this plugin sets no posting limits and
    // only states what the server allows. Another plugin's section would read
    // and save its own.
    limits: <PostingLimitsSection />,
    // Takes nothing from this form: this plugin stores no moderation setting.
    // Another plugin's section would read and save its own.
    moderation: <ModerationSection />,
    topics: (
      <>
        <SettingsSection
          disabled={!form}
          note={TopicAccessExtras && <TopicAccessExtras />}
          onChange={(key, value) =>
            handleSettingChange('topicAccess', key as keyof TopicAccessSettings, value)
          }
          settings={topicAccessSettings}
          subtitle={__('Choose what members can do on a topic.')}
          title={__('Topic access')}
        />
        {form && (
          <TopicFormSection disabled={!form} onChange={handleFieldModeChange} value={form.topicFormFields} />
        )}
      </>
    )
  }

  return (
    <div className="bc-px-6 bc-pb-6">
      <div className="bc-min-w-0 bc-pb-4 bc-pt-5">
        <Title className="bc-mb-0" level={3}>
          {__('Settings')}
        </Title>
      </div>

      {/* The status sits on the tab row: it speaks for every tab, the ones
          not open included. */}
      <div className="bc-mb-4 bc-flex bc-flex-wrap bc-items-center bc-justify-between bc-gap-3">
        <PageTabs onChange={setActiveTab} tabs={tabs} value={activeTab} />
        <SaveStatus
          error={save.error}
          onRetry={save.flushNow}
          retrying={save.retrying}
          status={save.status}
        />
      </div>

      {/* Top-aligned: each card is as tall as what it holds. Stretched to its
          row's tallest, a two-row card sat above a block of empty white. */}
      <div className="bc-grid bc-items-start bc-gap-5 xl:bc-grid-cols-2">{panels[activeTab]}</div>
    </div>
  )
}
