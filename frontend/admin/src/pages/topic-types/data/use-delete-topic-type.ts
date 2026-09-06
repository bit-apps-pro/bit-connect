import NotifyContext from '@common/context/NotifyContext'
import { __ } from '@common/helpers/i18nWrap'
import { type Response } from '@common/helpers/request'
import { wpApi } from '@common/request/wp-api'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useContext } from 'react'

import { type ErrorResponse } from './use-store-topic-type'

export default function useDeleteTopicType() {
  const queryClient = useQueryClient()
  const { messageApi } = useContext(NotifyContext)

  const { error, isError, isPending, mutateAsync } = useMutation<
    Response<string>,
    ErrorResponse,
    number
  >({
    mutationFn: async id => {
      return wpApi<{ id: number }, string>(`bit-connect-topic-types/${id}`, {
        method: 'DELETE',
        queryParam: { force: 'true' }
      })
    },
    mutationKey: ['topicTypes', 'delete'],
    onError: () => {
      messageApi?.error(__('Failed to delete topic type'))
    },
    onSuccess: () => {
      messageApi?.success(__('Topic type deleted successfully'))
      queryClient.invalidateQueries({ queryKey: ['topicTypes'] })
    }
  })

  return {
    deleteTopicType: mutateAsync,
    error: error,
    isDeletingTopicType: isPending,
    isError: isError
  }
}
