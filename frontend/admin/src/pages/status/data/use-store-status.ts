import NotifyContext from '@common/context/NotifyContext'
import { __ } from '@common/helpers/i18nWrap'
import { type Response } from '@common/helpers/request'
import { wpApi } from '@common/request/wp-api'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useContext } from 'react'

import { type Status } from '../shared/types'

export interface ErrorResponse {
  errors: { message: string }
}

export interface StatusRequestBody {
  description?: string
  meta: {
    color?: string
    icon_dark_id?: number
    icon_dark_url?: string
    icon_id?: number
    icon_url?: string
  }
  name: string
  /** Omitted lets WordPress derive one from the name. */
  slug?: string
}

export default function useStoreStatus() {
  const queryClient = useQueryClient()
  const { messageApi } = useContext(NotifyContext)

  const { error, isError, isPending, mutateAsync } = useMutation<
    Response<Status>,
    ErrorResponse,
    StatusRequestBody
  >({
    mutationFn: statusData => {
      return wpApi('bit-connect-statuses', {
        body: statusData,
        method: 'POST'
      })
    },
    mutationKey: ['bit-connect-statuses', 'store'],
    onSuccess: () => {
      messageApi?.success(__('Status created successfully'))
      queryClient.invalidateQueries({ queryKey: ['bit-connect-statuses'] })
    }
  })

  return {
    error: error,
    isError: isError,
    isStoringStatus: isPending,
    storeStatus: mutateAsync
  }
}
