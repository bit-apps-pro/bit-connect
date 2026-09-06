import NotifyContext from '@common/context/NotifyContext'
import { __ } from '@common/helpers/i18nWrap'
import { type Response } from '@common/helpers/request'
import { wpApi } from '@common/request/wp-api'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useContext } from 'react'

import { type ErrorResponse } from './use-store-tag'

export default function useDeleteTag() {
  const queryClient = useQueryClient()
  const { messageApi } = useContext(NotifyContext)

  const { error, isError, isPending, mutateAsync } = useMutation<
    Response<string>,
    ErrorResponse,
    number
  >({
    mutationFn: id => {
      return wpApi<{ id: number }, string>(`bit-connect-tags/${id}`, {
        method: 'DELETE',
        queryParam: { force: 'true' }
      })
    },
    mutationKey: ['tags', 'delete'],
    onError: () => {
      messageApi?.error(__('Failed to delete tag'))
    },
    onSuccess: () => {
      messageApi?.success(__('Tag deleted successfully'))
      queryClient.invalidateQueries({ queryKey: ['tags'] })
    }
  })

  return {
    deleteTag: mutateAsync,
    error: error,
    isDeletingTag: isPending,
    isError: isError
  }
}
