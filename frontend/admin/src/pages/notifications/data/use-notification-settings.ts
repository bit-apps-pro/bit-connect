import NotifyContext from '@common/context/NotifyContext'
import { __ } from '@common/helpers/i18nWrap'
import { request } from '@common/request'
import { type ResponseType } from '@common/request/types'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useContext } from 'react'

import { type NotificationSettingsData, type NotificationSettingsPayload } from '../shared/types'

const KEY = 'notification-settings'

/**
 * The forum-wide notification settings, plus the type catalogue.
 *
 * The catalogue comes from the server rather than a constant here, so the
 * screen cannot show a switch for a type that no longer fires, or miss one that
 * does. Same reason the placeholder help travels with it.
 */
export function useNotificationSettings() {
  const { data, isError, isPending } = useQuery<
    ResponseType<NotificationSettingsPayload>,
    Error,
    NotificationSettingsPayload
  >({
    queryFn: ({ signal }) => request<never, NotificationSettingsPayload>(KEY, { method: 'GET', signal }),
    queryKey: [KEY],
    retry: false,
    select: response => response?.data
  })

  return { isSettingsError: isError, isSettingsPending: isPending, payload: data }
}

export function useUpdateNotificationSettings() {
  const queryClient = useQueryClient()
  const { messageApi } = useContext(NotifyContext)

  const { isPending, mutateAsync } = useMutation({
    mutationFn: (settings: NotificationSettingsData) =>
      request<NotificationSettingsData, NotificationSettingsPayload>(`${KEY}/update`, {
        body: settings,
        method: 'POST'
      }),
    onError: () => messageApi?.error(__('Could not save notification settings')),
    onSuccess: response => {
      messageApi?.success(__('Notification settings saved'))
      // The server answers with the whole normalised payload, so the form
      // redraws from what was actually stored rather than from what was sent —
      // a digest hour of 99 comes back as 23.
      if (response?.data) {
        queryClient.setQueryData<ResponseType<NotificationSettingsPayload>>([KEY], response)
      }
    }
  })

  return { isUpdatingSettings: isPending, updateSettings: mutateAsync }
}

/**
 * Sends the signed-in admin one message using the settings as saved.
 *
 * Takes no address: the endpoint mails whoever is asking. A settings-page
 * diagnostic that accepts a recipient is an open relay wearing a lab coat.
 */
export function useSendTestEmail() {
  const { messageApi } = useContext(NotifyContext)

  const { isPending, mutateAsync } = useMutation({
    mutationFn: () => request<never, { sentTo: string }>(`${KEY}/test-email`, { method: 'POST' }),
    onError: (error: { errors?: { message?: string } }) =>
      messageApi?.error(
        error?.errors?.message ??
          __("WordPress could not send the message. Check this site's email configuration.")
      ),
    onSuccess: response =>
      messageApi?.success(
        response?.data?.sentTo
          ? `${__('Test email sent to')} ${response.data.sentTo}`
          : __('Test email sent')
      )
  })

  return { isSendingTest: isPending, sendTestEmail: mutateAsync }
}
