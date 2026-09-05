import { type Response } from '@common/helpers/request'
import { request } from '@common/request'
import { useMutation, useQueryClient } from '@tanstack/react-query'

import { type GeneralSettings, type GeneralSettingsFormData } from '../shared/types'

interface ErrorResponse {
  errors: { message: string }
}

export default function useUpdateGeneralSettings() {
  const queryClient = useQueryClient()
  const { error, isError, isPending, mutateAsync } = useMutation<
    Response<GeneralSettings>,
    ErrorResponse,
    GeneralSettingsFormData
  >({
    mutationFn: data =>
      request<GeneralSettingsFormData, GeneralSettings>('general-settings/update', {
        body: data,
        method: 'POST'
      }),
    mutationKey: ['general-settings', 'update'],
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['general-settings'] })
    }
  })

  return {
    error,
    isError,
    isUpdatingGeneralSettings: isPending,
    updateGeneralSettings: mutateAsync
  }
}
