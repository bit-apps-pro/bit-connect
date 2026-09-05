import NotifyContext from '@common/context/NotifyContext'
import { __ } from '@common/helpers/i18nWrap'
import { type Response } from '@common/helpers/request'
import { wpApi } from '@common/request/wp-api'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useContext } from 'react'

import { type TopicType } from '../shared/topic-type-types'
import { type ErrorResponse, type TopicTypeRequestBody } from './use-store-topic-type'

export default function useUpdateTopicType() {
  const queryClient = useQueryClient()
  const { messageApi } = useContext(NotifyContext)

  const { error, isError, isPending, mutateAsync } = useMutation<
    Response<TopicType>,
    ErrorResponse,
    { body: TopicTypeRequestBody; id: number }
  >({
    mutationFn: async ({ body, id }) => {
      return wpApi<TopicTypeRequestBody, TopicType>(`bit-connect-topic-types/${id}`, {
        body,
        method: 'PUT'
      })
    },
    mutationKey: ['topicTypes', 'update'],
    onError: () => {
      messageApi?.error(__('Failed to update topic type'))
    },
    onSuccess: () => {
      messageApi?.success(__('Topic type updated successfully'))
      queryClient.invalidateQueries({ queryKey: ['topicTypes'] })
    }
  })

  return {
    error: error,
    isError: isError,
    isUpdatingTopicType: isPending,
    updateTopicType: mutateAsync
  }
}
