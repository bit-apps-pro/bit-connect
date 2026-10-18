import { __ } from '@common/helpers/i18nWrap'
import useAutoSave from '@common/hooks/use-auto-save'
import { type ReactNode, useCallback, useMemo, useState } from 'react'

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

interface ForumSettingsProps {
  /** Which tab of the Settings screen this is drawing. */
  section: 'data' | 'limits' | 'moderation' | 'topics'
}

/**
 * The Topics, Moderation, Limits and Data tabs of the Settings screen: what
 * members can do on a topic, how content is reviewed, and what happens to it.
 */
export default function ForumSettings({ section }: ForumSettingsProps) {
  const { isSettingsPending, settings } = useSettings()
  const { updateSettings } = useUpdateSettings()

  const [form, setForm] = useState<SettingsFormData>()

  // Saved as it changes: each switch here is a whole setting on its own. A
  // short delay, since there is nothing to type — only a quick run of flips
  // to gather into one request.
  useAutoSave({
    delay: 300,
    draft: form,
    key: 'forum-settings',
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
        description: __('Let members comment on topics.'),
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
          subtitle={__('Turn each one on or off for the whole forum.')}
          title={__('What members can do')}
        />
        {form && (
          <TopicFormSection disabled={!form} onChange={handleFieldModeChange} value={form.topicFormFields} />
        )}
      </>
    )
  }

  // Top-aligned: each card is as tall as what it holds. Stretched to its
  // row's tallest, a two-row card sat above a block of empty white.
  return <div className="bc-grid bc-items-start bc-gap-5 xl:bc-grid-cols-2">{panels[section]}</div>
}
