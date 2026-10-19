import getRequest from '@utils/request/get'
import postRequest from '@utils/request/post'

import { type AdminSettings, type TopicFieldMode } from '../admin-settings.type'

const defaultSettings: AdminSettings = {
  topicAccess: {
    comment: false,
    upvote: false
  },
  topicFormFields: {
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
      topicType: fieldMode(settingsData.topicFormFields?.topicType, defaultSettings.topicFormFields.topicType)
    }
  }
}

let pending: Promise<AdminSettings> | undefined

/**
 * The forum options the portal reads — asked for once per page.
 *
 * The header and the topic page both asked for them as they mounted, which sent
 * the request twice on every topic page. The first answer serves the page; a
 * save replaces it (below), and a failed request is forgotten.
 */
export function fetchAdminSettingsApi(): Promise<AdminSettings> {
  pending ??= getRequest<AdminSettings>('settings')
    .then(response => normalizeAdminSettings(response.data))
    .catch((error: unknown) => {
      pending = undefined
      throw error
    })

  return pending
}

export async function updateAdminSettingsApi(settings: AdminSettings): Promise<AdminSettings> {
  const response = await postRequest<AdminSettings, AdminSettings>('settings/update', {
    body: settings
  })

  const saved = normalizeAdminSettings(response.data)
  pending = Promise.resolve(saved)

  return saved
}

/** Tests only: forget the shared answer, as a new page would. */
export const resetAdminSettingsForTests = () => {
  pending = undefined
}

export { defaultSettings }
