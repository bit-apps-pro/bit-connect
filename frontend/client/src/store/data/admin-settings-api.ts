import getRequest from '@utils/request/get'
import postRequest from '@utils/request/post'

import { type AdminSettings, type TopicFieldMode } from '../admin-settings.type'

const defaultSettings: AdminSettings = {
  topicAccess: {
    comment: false,
    upvote: false
  },
  topicFormFields: {
    department: 'required',
    topicType: 'required'
  }
}

const FIELD_MODES: ReadonlySet<unknown> = new Set<TopicFieldMode>(['hidden', 'optional', 'required'])

function fieldMode(value: unknown, fallback: TopicFieldMode): TopicFieldMode {
  return FIELD_MODES.has(value) ? (value as TopicFieldMode) : fallback
}

function normalizeAdminSettings(data: unknown): AdminSettings {
  if (!data || typeof data !== 'object') {
    return defaultSettings
  }

  const settingsData = data as Partial<AdminSettings>

  return {
    topicAccess: {
      comment: settingsData.topicAccess?.comment ?? defaultSettings.topicAccess.comment,
      upvote: settingsData.topicAccess?.upvote ?? defaultSettings.topicAccess.upvote
    },
    topicFormFields: {
      department: fieldMode(
        settingsData.topicFormFields?.department,
        defaultSettings.topicFormFields.department
      ),
      topicType: fieldMode(settingsData.topicFormFields?.topicType, defaultSettings.topicFormFields.topicType)
    }
  }
}

export async function fetchAdminSettingsApi(): Promise<AdminSettings> {
  const response = await getRequest<AdminSettings>('settings')
  return normalizeAdminSettings(response.data)
}

export async function updateAdminSettingsApi(settings: AdminSettings): Promise<AdminSettings> {
  const response = await postRequest<AdminSettings, AdminSettings>('settings/update', {
    body: settings
  })

  return normalizeAdminSettings(response.data)
}

export { defaultSettings }
