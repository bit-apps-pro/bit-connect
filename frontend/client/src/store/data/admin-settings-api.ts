import getRequest from '@utils/request/get'
import postRequest from '@utils/request/post'

import { type AdminSettings } from '../admin-settings.type'

const defaultSettings: AdminSettings = {
  topicAccess: {
    comment: false,
    commentUpvote: false,
    privateTopic: false,
    upvote: false
  },
  topicFormFields: {
    requireDepartment: true,
    requireTopicType: true
  }
}

function normalizeAdminSettings(data: unknown): AdminSettings {
  if (!data || typeof data !== 'object') {
    return defaultSettings
  }

  const settingsData = data as Partial<AdminSettings>

  return {
    topicAccess: {
      comment: settingsData.topicAccess?.comment ?? defaultSettings.topicAccess.comment,
      commentUpvote:
        settingsData.topicAccess?.commentUpvote ?? defaultSettings.topicAccess.commentUpvote,
      privateTopic: settingsData.topicAccess?.privateTopic ?? defaultSettings.topicAccess.privateTopic,
      upvote: settingsData.topicAccess?.upvote ?? defaultSettings.topicAccess.upvote
    },
    topicFormFields: {
      requireDepartment:
        settingsData.topicFormFields?.requireDepartment ??
        defaultSettings.topicFormFields.requireDepartment,
      requireTopicType:
        settingsData.topicFormFields?.requireTopicType ??
        defaultSettings.topicFormFields.requireTopicType
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
