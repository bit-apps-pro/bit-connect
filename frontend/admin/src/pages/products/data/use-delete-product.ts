import NotifyContext from '@common/context/NotifyContext'
import { __ } from '@common/helpers/i18nWrap'
import { type Response } from '@common/helpers/request'
import { wpApi } from '@common/request/wp-api'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useContext } from 'react'

import { type ErrorResponse } from './use-store-product'

export default function useDeleteStage() {
  const queryClient = useQueryClient()
  const { messageApi } = useContext(NotifyContext)

  const { error, isError, isPending, mutateAsync } = useMutation<
    Response<string>,
    ErrorResponse,
    number
  >({
    mutationFn: async id => {
      return wpApi<{ id: number }, string>(`bit-connect-departments/${id}`, {
        method: 'DELETE',
        queryParam: { force: 'true' }
      })
    },
    mutationKey: ['departments', 'delete'],
    onError: () => {
      messageApi?.error(__('Failed to delete department'))
    },
    onSuccess: () => {
      messageApi?.success(__('Department deleted successfully'))
      queryClient.invalidateQueries({ queryKey: ['departments'] })
    }
  })

  return {
    deleteProduct: mutateAsync,
    error: error,
    isDeletingProduct: isPending,
    isError: isError
  }
}
