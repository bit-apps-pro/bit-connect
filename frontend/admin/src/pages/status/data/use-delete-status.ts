import NotifyContext from '@common/context/NotifyContext'
import { __ } from '@common/helpers/i18nWrap'
import { type Response } from '@common/helpers/request'
import { wpApi } from '@common/request/wp-api'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useContext } from 'react'

import { type ErrorResponse } from './use-store-status'

export default function useDeleteStatus() {
  const queryClient = useQueryClient()
  const { messageApi } = useContext(NotifyContext)

  const { error, isError, isPending, mutateAsync } = useMutation<
    Response<string>,
    ErrorResponse,
    number
  >({
    mutationFn: id => {
      return wpApi<{ id: number }, string>(`bit-connect-statuses/${id}`, {
        method: 'DELETE',
        queryParam: { force: 'true' }
      })
    },
    mutationKey: ['bit-connect-statuses', 'delete'],
    onError: () => {
      messageApi?.error(__('Failed to delete status'))
    },
    onSuccess: () => {
      messageApi?.success(__('Status deleted successfully'))
      queryClient.invalidateQueries({ queryKey: ['bit-connect-statuses'] })
    }
  })

  return {
    deleteStatus: mutateAsync,
    error: error,
    isDeletingStatus: isPending,
    isError: isError
  }
}
