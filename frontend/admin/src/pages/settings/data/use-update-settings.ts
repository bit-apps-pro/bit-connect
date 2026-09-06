import NotifyContext from '@common/context/NotifyContext'
import { __ } from '@common/helpers/i18nWrap'
import { type Response } from '@common/helpers/request'
import { request } from '@common/request'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useContext } from 'react'

import { type Settings, type SettingsFormData } from '../shared/types'

export interface ErrorResponse {
  errors: { message: string }
}

export default function useUpdateSettings() {
  const queryClient = useQueryClient()
  const { messageApi } = useContext(NotifyContext)

  const { error, isError, isPending, mutateAsync } = useMutation<
    Response<Settings>,
    ErrorResponse,
    SettingsFormData
  >({
    mutationFn: async settingsData => {
      return request<SettingsFormData, Settings>('settings/update', {
        body: settingsData,
        method: 'POST'
      })
    },
    mutationKey: ['settings', 'update'],
    onError: () => {
      messageApi?.error(__('Failed to update settings'))
    },
    onSuccess: () => {
      messageApi?.success(__('Settings updated successfully'))
      queryClient.invalidateQueries({ queryKey: ['settings'] })
    }
  })

  return {
    error: error,
    isError: isError,
    isUpdatingSettings: isPending,
    updateSettings: mutateAsync
  }
}
