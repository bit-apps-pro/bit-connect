import { __ } from '@common/helpers/i18nWrap'
import { IS_PRO_ACTIVE } from '@common/helpers/pro-access'
import { Alert, Button, Descriptions, Typography } from 'antd'
import { useCallback, useEffect, useMemo, useState } from 'react'

import useSettings from './data/use-settings'
import useUpdateSettings from './data/use-update-settings'
import { type ErrorResponse } from './data/use-update-settings'
import ModerationSection from './internal/moderation-section'
import SettingsSection from './internal/settings-section'
import {
  type CleanupSettings,
  type SettingsFormData,
  type TopicAccessSettings,
  type TopicFormFieldsSettings
} from './shared/types'

const { Title } = Typography

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

function MediaLimitsInfo() {
  const media = getWpMediaSettings()
  const maxSize = media ? formatBytes(media.maxUploadBytes) : '—'
  const maxPx = media ? `${media.bigImageThresholdPx} px` : '—'

  return (
    <div className="bc-mt-6 bc-rounded-lg bc-border bc-border-solid bc-border-line bc-p-5">
      <Title className="bc-mb-1" level={5}>
        {__('WordPress Media Limits')}
      </Title>
      <p className="bc-mb-4 bc-text-sm bc-text-ink-muted">
        {__(
          'These limits are controlled by your server and WordPress. Pasted images that exceed them are automatically resized before upload.'
        )}
      </p>
      <Descriptions bordered column={1} size="small">
        <Descriptions.Item label={__('Max upload size')}>
          <span className="bc-font-medium">{maxSize}</span>
          <span className="bc-ml-2 bc-text-xs bc-text-ink-subtle">
            {__('(set by server php.ini via wp_max_upload_size)')}
          </span>
        </Descriptions.Item>
        <Descriptions.Item label={__('Max image dimensions')}>
          <span className="bc-font-medium">{maxPx}</span>
          <span className="bc-ml-2 bc-text-xs bc-text-ink-subtle">
            {__('(WordPress big_image_size_threshold filter, default 2560 px)')}
          </span>
        </Descriptions.Item>
        <Descriptions.Item label={__('Allowed file types')}>
          <span className="bc-font-medium">JPEG, PNG, GIF, WebP, PDF, DOC, DOCX</span>
        </Descriptions.Item>
      </Descriptions>
    </div>
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
        // Defaulted here as well as on the server: an admin bundle newer than
        // the stored settings would otherwise put `undefined` in the input and
        // save it back as a threshold of nothing.
        moderation: { autoHideThreshold: settings.moderation?.autoHideThreshold ?? 2 },
        topicAccess: { ...settings.topicAccess },
        topicFormFields: { ...settings.topicFormFields }
      })
    }
  }, [settings])

  const handleSettingChange = useCallback(
    (
      section: 'cleanup' | 'topicAccess' | 'topicFormFields',
      key: keyof CleanupSettings | keyof TopicAccessSettings | keyof TopicFormFieldsSettings,
      value: boolean
    ) => {
      setForm(prev => {
        if (!prev) return prev
        const updated: SettingsFormData = {
          cleanup: { ...prev.cleanup },
          moderation: { ...prev.moderation },
          topicAccess: { ...prev.topicAccess },
          topicFormFields: { ...prev.topicFormFields }
        }
        if (section === 'topicAccess') {
          updated.topicAccess[key as keyof TopicAccessSettings] = value
        } else if (section === 'topicFormFields') {
          updated.topicFormFields[key as keyof TopicFormFieldsSettings] = value
        } else {
          updated.cleanup[key as keyof CleanupSettings] = value
        }
        return updated
      })
    },
    []
  )

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
        description: __('On/off your Topic Upvote'),
        key: 'upvote',
        label: __('Upvote'),
        value: form.topicAccess.upvote ?? false
      },
      {
        description: __('On/off your Comment'),
        key: 'comment',
        label: __('Comment'),
        value: form.topicAccess.comment ?? false
      },
      {
        description: __('On/off your Topic comment Upvote'),
        key: 'commentUpvote',
        label: __('Comment Upvote'),
        // Same shape as Private Topic below: not a code split, because the
        // control is identical either way and only held off. The server is the
        // real gate — it reports this setting as false and refuses the vote
        // unless pro is licensed.
        proOnly: !IS_PRO_ACTIVE,
        value: form.topicAccess.commentUpvote ?? false
      },
      {
        description: __('Let authors keep a topic private, visible only to them and the forum team'),
        key: 'privateTopic',
        label: __('Private Topic'),
        // Not a code split: the control is the same either way, only held off.
        // The server is the real gate — it reports this setting as false and
        // refuses a private topic unless pro is licensed.
        proOnly: !IS_PRO_ACTIVE,
        value: form.topicAccess.privateTopic ?? false
      }
    ]
  }, [form])

  const cleanupSettings = useMemo(() => {
    if (!form?.cleanup) return []
    return [
      {
        description: __('Delete all plugin settings, terms and posts when uninstalling this plugin'),
        key: 'deleteDataOnUninstall',
        label: __('Delete Data on Uninstall'),
        value: form.cleanup.deleteDataOnUninstall ?? false
      }
    ]
  }, [form])

  const topicFormFieldsSettings = useMemo(() => {
    if (!form?.topicFormFields) return []
    return [
      {
        description: __('Show and require Topic Type when creating a topic'),
        key: 'requireTopicType',
        label: __('Require Topic Type'),
        value: form.topicFormFields.requireTopicType ?? true
      },
      {
        description: __('Show and require Products/Department when creating a topic'),
        key: 'requireDepartment',
        label: __('Require Products/Department'),
        value: form.topicFormFields.requireDepartment ?? true
      }
    ]
  }, [form])

  return (
    <div>
      <div className="bc-py-6 bc-px-5 bc-flex bc-items-center bc-justify-between">
        <Title className="bc-mb-0" level={2}>
          {__('Settings')}
        </Title>
        <Button
          disabled={isUpdatingSettings}
          loading={isUpdatingSettings}
          onClick={handleSave}
          type="primary"
        >
          {__('Save')}
        </Button>
      </div>

      {errorMessage && (
        <div className="bc-px-5 bc-mb-4">
          <Alert message={errorMessage} type="error" />
        </div>
      )}

      <div className="bc-px-5">
        <SettingsSection
          disabled={isUpdatingSettings}
          onChange={(key, value) =>
            handleSettingChange('topicAccess', key as keyof TopicAccessSettings, value)
          }
          settings={topicAccessSettings}
          subtitle={__('Choose what members can do on a topic')}
          title={__('Topic Access Settings')}
        />
        <SettingsSection
          disabled={isUpdatingSettings}
          onChange={(key, value) =>
            handleSettingChange('topicFormFields', key as keyof TopicFormFieldsSettings, value)
          }
          settings={topicFormFieldsSettings}
          subtitle={__('Control which fields are shown and required when creating a topic')}
          title={__('Topic Form Fields')}
        />
        <ModerationSection
          autoHideThreshold={form?.moderation?.autoHideThreshold ?? 2}
          disabled={isUpdatingSettings}
          onChange={autoHideThreshold =>
            setForm(prev => (prev ? { ...prev, moderation: { autoHideThreshold } } : prev))
          }
        />
        <SettingsSection
          disabled={isUpdatingSettings}
          onChange={(key, value) => handleSettingChange('cleanup', key as keyof CleanupSettings, value)}
          settings={cleanupSettings}
          subtitle={__('Manage what data is removed when the plugin is uninstalled')}
          title={__('Data Cleanup')}
        />

        <MediaLimitsInfo />
      </div>
    </div>
  )
}
