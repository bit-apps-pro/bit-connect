import NotifyContext from '@common/context/NotifyContext'
import { __ } from '@common/helpers/i18nWrap'
import { type Response } from '@common/helpers/request'
import { wpApi } from '@common/request/wp-api'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useContext } from 'react'

import { type TopicType } from '../shared/topic-type-types'

export interface TopicTypeRequestBody {
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

export interface ErrorResponse {
  errors: { message: string }
}

export default function useStoreTopicType() {
  const queryClient = useQueryClient()
  const { messageApi } = useContext(NotifyContext)

  const { error, isError, isPending, mutateAsync } = useMutation<
    Response<TopicType>,
    ErrorResponse,
    TopicTypeRequestBody
  >({
    mutationFn: async topicTypeData => {
      await new Promise(resolve => setTimeout(resolve, 500))
      return wpApi<TopicTypeRequestBody, TopicType>('bit-connect-topic-types', {
        body: topicTypeData,
        method: 'POST'
      })
    },
    mutationKey: ['topicTypes', 'store'],
    onSuccess: () => {
      messageApi?.success(__('Topic type created successfully'))
      queryClient.invalidateQueries({ queryKey: ['topicTypes'] })
    }
  })

  return {
    error: error,
    isError: isError,
    isStoringTopicType: isPending,
    storeTopicType: mutateAsync
  }
}
