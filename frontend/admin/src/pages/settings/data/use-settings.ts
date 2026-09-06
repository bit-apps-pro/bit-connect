import { request } from '@common/request'
import { type ResponseType } from '@common/request/types'
import { useQuery } from '@tanstack/react-query'

import { type Settings } from '../shared/types'

// Default/mock settings data
const defaultSettings: Settings = {
  cleanup: {
    deleteDataOnUninstall: false
  },
  // Two, matching ReportService::DEFAULT_AUTO_HIDE_THRESHOLD. A default of 1
  // here would show "hide after 1 report" on a site the server is running at 2.
  moderation: {
    autoHideThreshold: 2
  },
  topicAccess: {
    comment: true,
    commentUpvote: false,
    privateTopic: false,
    upvote: true
  },
  topicFormFields: {
    requireDepartment: true,
    requireTopicType: true
  }
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
          moderation: {
            autoHideThreshold:
              settingsData.moderation?.autoHideThreshold ?? defaultSettings.moderation.autoHideThreshold
          },
          topicAccess: {
            comment: settingsData.topicAccess?.comment ?? defaultSettings.topicAccess.comment,
            commentUpvote:
              settingsData.topicAccess?.commentUpvote ?? defaultSettings.topicAccess.commentUpvote,
            privateTopic:
              settingsData.topicAccess?.privateTopic ?? defaultSettings.topicAccess.privateTopic,
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
