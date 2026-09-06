import NotifyContext from '@common/context/NotifyContext'
import { __ } from '@common/helpers/i18nWrap'
import { type Response } from '@common/helpers/request'
import queryRequest from '@common/helpers/request'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { type FormInstance } from 'antd'
import { useContext } from 'react'

import { slugDisclosure } from '../shared/slug-disclosure'
import { type SaveTopicPayload, type Topic } from '../shared/type'

export default function useUpdateTopic(form: FormInstance) {
  const { notificationApi } = useContext(NotifyContext)
  const queryClient = useQueryClient()

  const { error, isError, isPending, mutateAsync } = useMutation<
    Response<Topic>,
    Response<string> | Response<ValidationType<SaveTopicPayload>>,
    SaveTopicPayload
  >({
    mutationFn: async data => queryRequest<Topic>(`topics/${data.topic_id}`, data),
    mutationKey: ['topics', 'update'],
    onError: error => {
      if (typeof error.data === 'object') {
        const errors = Object.entries(error.data).map(([key, messages]) => ({
          errors: messages,
          name: key
        }))

        form.setFields(errors)
        return
      }

      notificationApi?.error({ message: error.data || __('Could not update topic') })
    },
    onSuccess: (response, payload) => {
      notificationApi?.success({
        description: slugDisclosure(payload.post_name, response.data?.post_name),
        message: __('Topic updated successfully')
      })
      queryClient.invalidateQueries({ queryKey: ['topics'] })
      // The next check must not be answered from the cache with the verdict
      // taken before this save moved a slug around.
      queryClient.invalidateQueries({ queryKey: ['topic-slug-check'] })
    }
  })

  if (isError) {
    console.error(error)
  }

  return {
    isUpdatingTopic: isPending,
    updateTopic: mutateAsync
  }
}
