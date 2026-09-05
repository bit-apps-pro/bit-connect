import NotifyContext from '@common/context/NotifyContext'
import { __ } from '@common/helpers/i18nWrap'
import { type Response } from '@common/helpers/request'
import { wpApi } from '@common/request/wp-api'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useContext } from 'react'

import { type Status } from '../shared/types'
import { STATUSES_QUERY_KEY } from './use-statuses'
import { type ErrorResponse, type StatusRequestBody } from './use-store-status'

export default function useUpdateStatus() {
  const queryClient = useQueryClient()
  const { messageApi } = useContext(NotifyContext)

  const { error, isError, isPending, mutateAsync } = useMutation<
    Response<Status>,
    ErrorResponse,
    { body: StatusRequestBody; id: number }
  >({
    mutationFn: ({ body, id }) => {
      return wpApi(`bit-connect-statuses/${id}`, {
        body,
        method: 'PUT'
      })
    },
    mutationKey: ['bit-connect-statuses', 'update'],
    onError: () => {
      messageApi?.error(__('Failed to update status'))
    },
    onSuccess: () => {
      messageApi?.success(__('Status updated successfully'))
      queryClient.invalidateQueries({ queryKey: STATUSES_QUERY_KEY })
    }
  })

  return {
    error: error,
    isError: isError,
    isUpdatingStatus: isPending,
    updateStatus: mutateAsync
  }
}
