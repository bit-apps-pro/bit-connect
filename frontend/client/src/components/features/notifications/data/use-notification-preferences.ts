import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import config from '@/config/config'
import get from '@/utils/request/get'
import post from '@/utils/request/post'
import { type ResponseType } from '@/utils/request/types'

/** One row of the preference screen, as the server resolved it. */
export interface NotificationPreferenceRow {
  /** True when the forum delivers this whatever the member says. */
  alwaysDelivered: boolean
  description: string
  email: boolean
  /** True when the admin has taken this choice away, or the forum requires it. */
  emailLocked: boolean
  inapp: boolean
  inappLocked: boolean
  label: string
  type: string
}

interface NotificationPreferences {
  frequency: 'daily' | 'instant' | 'never' | 'weekly'
  types: NotificationPreferenceRow[]
}

interface SavePreferencesPayload {
  frequency?: string
  types?: Record<string, { email?: boolean; inapp?: boolean }>
}

export const PREFERENCES_KEY = 'notification-preferences'

/**
 * The member's own notification settings.
 *
 * Every value here is resolved server-side by the same code the dispatcher
 * uses, so the screen cannot disagree with what actually gets sent — a form
 * that computes its own answer from stored preferences drifts the moment an
 * admin changes a default.
 */
export function useNotificationPreferences() {
  const { data, isError, isPending } = useQuery<
    ResponseType<NotificationPreferences>,
    Error,
    NotificationPreferences
  >({
    enabled: config.IS_LOGGED_IN,
    queryFn: ({ signal }) => get<NotificationPreferences>('notification-preferences', { signal }),
    queryKey: [PREFERENCES_KEY],
    retry: false,
    select: response => response?.data
  })

  return {
    isPreferencesError: isError,
    isPreferencesLoading: isPending,
    preferences: data
  }
}

/**
 * Save the member's choices.
 *
 * The server answers with the whole screen rather than an acknowledgement, and
 * that answer replaces the cache. A row the admin has locked is silently
 * dropped on save, so a client trusting its own optimistic state would go on
 * showing a switch the forum never accepted.
 */
export function useSaveNotificationPreferences() {
  const queryClient = useQueryClient()

  const { isPending, mutateAsync } = useMutation({
    mutationFn: (payload: SavePreferencesPayload) =>
      post<SavePreferencesPayload, NotificationPreferences>('notification-preferences', {
        body: payload
      }),
    onSuccess: response => {
      if (response?.data) {
        queryClient.setQueryData<ResponseType<NotificationPreferences>>([PREFERENCES_KEY], response)
      }
    }
  })

  return { isSavingPreferences: isPending, savePreferences: mutateAsync }
}
