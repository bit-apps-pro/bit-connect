import { __ } from '@common/helpers/i18nWrap'
import { Alert, Button, Divider, Typography } from 'antd'
import { useCallback, useEffect, useMemo, useState } from 'react'

import useSettings from './data/use-settings'
import useUpdateSettings from './data/use-update-settings'
import { type ErrorResponse } from './data/use-update-settings'
import ModerationSection from './internal/moderation-section'
import SectionCard from './internal/section-card'
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

const { Text, Title } = Typography

interface WpMediaSettings {
  bigImageThresholdPx: number
  maxUploadBytes: number
}

function getWpMediaSettings(): undefined | WpMediaSettings {
  return (window as unknown as { bit_connect_?: { wpMediaSettings?: WpMediaSettings } }).bit_connect_
    ?.wpMediaSettings
}

function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(0)} MB`
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${bytes} B`
}

interface MediaLimitRowProps {
  hint?: string
  label: string
  value: string
}

function MediaLimitRow({ hint, label, value }: MediaLimitRowProps) {
  return (
    <>
      <Divider className="bc-my-0" />
      <div className="bc-py-4 last:bc-pb-0 sm:bc-flex sm:bc-items-baseline sm:bc-gap-6">
        <Text className="bc-mb-1 bc-block bc-text-sm bc-font-medium bc-text-ink sm:bc-w-64 sm:bc-shrink-0">{label}</Text>
        <div className="bc-min-w-0">
          <Text className="bc-text-sm bc-text-ink" strong>
            {value}
          </Text>
          {hint && (
            <Text className="bc-ml-2 bc-text-sm" type="secondary">
              {hint}
            </Text>
          )}
        </div>
      </div>
    </>
  )
}

function MediaLimitsInfo() {
  const media = getWpMediaSettings()
  const maxSize = media ? formatBytes(media.maxUploadBytes) : '—'
  const maxPx = media ? `${media.bigImageThresholdPx} px` : '—'

  return (
    <SectionCard
      subtitle={__(
        'These limits are controlled by your server and WordPress. Pasted images that exceed them are automatically resized before upload.'
      )}
      title={__('WordPress Media Limits')}
    >
      <div>
        <MediaLimitRow
          hint={__('(set by server php.ini via wp_max_upload_size)')}
          label={__('Max upload size')}
          value={maxSize}
        />
        <MediaLimitRow
          hint={__('(WordPress big_image_size_threshold filter, default 2560 px)')}
          label={__('Max image dimensions')}
          value={maxPx}
        />
        <MediaLimitRow label={__('Allowed file types')} value="JPEG, PNG, GIF, WebP, PDF, DOC, DOCX" />
      </div>
    </SectionCard>
  )
}

const getErrorMessage = (error: ErrorResponse | null, isError: boolean) => {
  if (isError) {
    return error?.errors?.message ?? undefined
  }
  return
}

export default function Settings() {
  const { settings } = useSettings()
  const { error, isError, isUpdatingSettings, updateSettings } = useUpdateSettings()
  const errorMessage = getErrorMessage(error, isError)

  const [form, setForm] = useState<SettingsFormData>()

  useEffect(() => {
    if (settings) {
      setForm({
        cleanup: { ...settings.cleanup },
        topicAccess: { ...settings.topicAccess },
        topicFormFields: { ...settings.topicFormFields }
      })
    }
  }, [settings])

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

  const handleSave = useCallback(async () => {
    if (!form) return
    try {
      await updateSettings(form)
    } catch {
      // error handled via hook
    }
  }, [form, updateSettings])

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

  return (
    <div className="bc-p-6">
      <div className="bc-mb-5 bc-flex bc-flex-wrap bc-items-start bc-justify-between bc-gap-4">
        <div className="bc-min-w-0">
          <Title className="bc-mb-0" level={3}>
            {__('Settings')}
          </Title>
        </div>
        <Button
          disabled={isUpdatingSettings}
          loading={isUpdatingSettings}
          onClick={handleSave}
          size="large"
          type="primary"
        >
          {__('Save')}
        </Button>
      </div>

      {errorMessage && <Alert className="bc-mb-5" message={errorMessage} type="error" />}

      {/* Top-aligned: each card is as tall as what it holds. Stretched to its
          row's tallest, a two-row card sat above a block of empty white. */}
      <div className="bc-grid bc-items-start bc-gap-5 xl:bc-grid-cols-2">
        <SettingsSection
          disabled={isUpdatingSettings}
          note={TopicAccessExtras && <TopicAccessExtras />}
          onChange={(key, value) =>
            handleSettingChange('topicAccess', key as keyof TopicAccessSettings, value)
          }
          settings={topicAccessSettings}
          subtitle={__('Choose what members can do on a topic.')}
          title={__('Topic access')}
        />
        {form && (
          <TopicFormSection
            disabled={isUpdatingSettings}
            onChange={handleFieldModeChange}
            value={form.topicFormFields}
          />
        )}
        {/* Takes nothing from this form: this plugin stores no moderation
            setting. Another plugin's section would read and save its own. */}
        <ModerationSection />
        <SettingsSection
          disabled={isUpdatingSettings}
          onChange={(key, value) => handleSettingChange('cleanup', key as keyof CleanupSettings, value)}
          settings={cleanupSettings}
          subtitle={__('Choose what happens to your community’s data if the plugin is deleted.')}
          title={__('Data cleanup')}
        />

        <div className="xl:bc-col-span-2">
          <MediaLimitsInfo />
        </div>
      </div>
    </div>
  )
}
