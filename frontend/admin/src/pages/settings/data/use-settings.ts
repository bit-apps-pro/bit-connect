import { request } from '@common/request'
import { type ResponseType } from '@common/request/types'
import { useQuery } from '@tanstack/react-query'

import { type Settings, type TopicFieldMode } from '../shared/types'

// Default/mock settings data
const defaultSettings: Settings = {
  cleanup: {
    deleteDataOnUninstall: false
  },
  topicAccess: {
    comment: true,
    upvote: true
  },
  topicFormFields: {
    topicType: 'required'
  }
}

const FIELD_MODES: ReadonlySet<unknown> = new Set<TopicFieldMode>(['hidden', 'optional', 'required'])

function fieldMode(value: unknown, fallback: TopicFieldMode): TopicFieldMode {
  return FIELD_MODES.has(value) ? (value as TopicFieldMode) : fallback
}

export default function useSettings() {
  const { data, isError, isFetching, isPending, refetch } = useQuery<
    ResponseType<Settings>,
    Error,
    Settings
  >({
    queryFn: ({ signal }) => {
      try {
        return request<never, Settings>('settings', { method: 'GET', signal })
      } catch (error) {
        // Return mock data wrapped in ResponseType if API fails
        console.warn('Failed to fetch settings, using default values:', error)
        return {
          code: 'SUCCESS',
          data: defaultSettings,
          status: 'success'
        } as ResponseType<Settings>
      }
    },
    queryKey: ['settings'],
    retry: false,
    select: response => {
      const settingsData = response?.data ?? response
      // Ensure the response has the required structure
      if (settingsData && typeof settingsData === 'object' && 'topicAccess' in settingsData) {
        return {
          cleanup: {
            deleteDataOnUninstall:
              settingsData.cleanup?.deleteDataOnUninstall ??
              defaultSettings.cleanup.deleteDataOnUninstall
          },
          topicAccess: {
            comment: settingsData.topicAccess?.comment ?? defaultSettings.topicAccess.comment,
            upvote: settingsData.topicAccess?.upvote ?? defaultSettings.topicAccess.upvote
          },
          topicFormFields: {
            topicType: fieldMode(
              settingsData.topicFormFields?.topicType,
              defaultSettings.topicFormFields.topicType
            )
          }
        }
      }
      return defaultSettings
    }
  })

  return {
    isSettingsError: isError,
    isSettingsFetching: isFetching,
    isSettingsPending: isPending,
    refetchSettings: refetch,
    settings: data ?? defaultSettings
  }
}
