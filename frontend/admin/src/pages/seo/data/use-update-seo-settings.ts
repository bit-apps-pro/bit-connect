import NotifyContext from '@common/context/NotifyContext'
import { __ } from '@common/helpers/i18nWrap'
import { type Response } from '@common/helpers/request'
import { request } from '@common/request'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useContext } from 'react'

import { type SeoSettings, type SeoSettingsResponse } from '../shared/types'

export interface ErrorResponse {
  errors: { message: string }
}

export default function useUpdateSeoSettings() {
  const queryClient = useQueryClient()
  const { messageApi } = useContext(NotifyContext)

  const { error, isError, isPending, mutateAsync } = useMutation<
    Response<SeoSettingsResponse>,
    ErrorResponse,
    SeoSettings
  >({
    mutationFn: async settings =>
      request<SeoSettings, SeoSettingsResponse>('seo-settings/update', {
        body: settings,
        method: 'POST'
      }),
    mutationKey: ['seo-settings', 'update'],
    onError: () => {
      messageApi?.error(__('Failed to update SEO settings'))
    },
    onSuccess: () => {
      messageApi?.success(__('SEO settings updated'))
      // Refetches the diagnostics too — several of them (indexable archives,
      // whether an SEO plugin is bridged) change as a direct result of a save.
      queryClient.invalidateQueries({ queryKey: ['seo-settings'] })
    }
  })

  return {
    error,
    isError,
    isUpdatingSeoSettings: isPending,
    updateSeoSettings: mutateAsync
  }
}
