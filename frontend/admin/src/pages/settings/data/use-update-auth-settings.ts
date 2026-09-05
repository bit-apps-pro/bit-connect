import { type Response } from '@common/helpers/request'
import { request } from '@common/request'
import { useMutation, useQueryClient } from '@tanstack/react-query'

import { type AuthSettings, type AuthSettingsFormData } from '../shared/types'

/**
 * `request()` resolves for every response the server parses, error payloads
 * included, so a rejected save would otherwise be reported as a success. Turn
 * an error payload back into a rejection carrying a readable message.
 */
function assertSaved(response: Response<AuthSettings>): Response<AuthSettings> {
  if (response?.status !== 'error') return response

  const data = response.data as unknown
  const fieldMessages =
    data && typeof data === 'object'
      ? Object.values(data as Record<string, string | string[]>)
          .flat()
          .filter(Boolean)
      : []

  throw new Error(
    (typeof data === 'string' ? data : fieldMessages.join(' ')) ||
      'Failed to save authentication settings'
  )
}

export default function useUpdateAuthSettings() {
  const queryClient = useQueryClient()
  const { error, isError, isPending, mutateAsync } = useMutation<
    Response<AuthSettings>,
    { errors: { message: string } },
    AuthSettingsFormData
  >({
    mutationFn: data =>
      request<AuthSettingsFormData, AuthSettings>('auth-settings/update', {
        body: data,
        method: 'POST'
      }).then(assertSaved),
    mutationKey: ['auth-settings', 'update'],
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['auth-settings'] })
    }
  })

  return {
    error,
    isError,
    isUpdatingAuthSettings: isPending,
    updateAuthSettings: mutateAsync
  }
}
