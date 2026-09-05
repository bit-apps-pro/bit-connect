import NotifyContext from '@common/context/NotifyContext'
import { __ } from '@common/helpers/i18nWrap'
import { type Response } from '@common/helpers/request'
import { wpApi } from '@common/request/wp-api'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useContext } from 'react'

import { type ErrorResponse } from './use-save-stage'

export default function useDeleteStage() {
  const queryClient = useQueryClient()
  const { messageApi } = useContext(NotifyContext)

  const { error, isError, isPending, mutateAsync } = useMutation<
    Response<string>,
    ErrorResponse,
    number
  >({
    mutationFn: id => {
      return wpApi<{ id: number }, string>(`bit-connect-stages/${id}`, {
        method: 'DELETE',
        queryParam: { force: 'true' }
      })
    },
    mutationKey: ['stages', 'delete'],
    onError: () => {
      messageApi?.error(__('Failed to delete stage'))
    },
    onSuccess: () => {
      messageApi?.success(__('Stage deleted successfully'))
      queryClient.invalidateQueries({ queryKey: ['stages'] })
    }
  })

  return {
    deleteStage: mutateAsync,
    error: error,
    isDeletingStage: isPending,
    isError: isError
  }
}
