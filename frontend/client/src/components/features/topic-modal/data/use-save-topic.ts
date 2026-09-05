import NotifyContext from '@common/context/NotifyContext'
import { __ } from '@common/helpers/i18nWrap'
import { type Response } from '@common/helpers/request'
import queryRequest from '@common/helpers/request'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { type FormInstance } from 'antd'
import { useContext } from 'react'

import { usePostsStore } from '@/store/posts.zustand'

import { slugDisclosure } from '../shared/slug-disclosure'
import { type SaveTopicPayload, type Topic } from '../shared/type'

export default function useSaveTopic(form: FormInstance) {
  const { notificationApi } = useContext(NotifyContext)
  const fetchAllPosts = usePostsStore(state => state.fetchAllPosts)
  const queryClient = useQueryClient()

  const { error, isError, isPending, mutateAsync } = useMutation<
    Response<Topic>,
    Response<string> | Response<ValidationType<SaveTopicPayload>>,
    SaveTopicPayload
  >({
    mutationFn: async (data: SaveTopicPayload) => queryRequest<Topic>('topics', data),
    mutationKey: ['topics', 'store'],
    onError: error => {
      if (error.code === 'VALIDATION' && error.data && typeof error.data === 'object') {
        const errors = Object.entries(error.data).map(([key, messages]) => ({
          errors: messages,
          name: key
        }))

        form.setFields(errors)
        return
      }

      const msg =
        typeof error.data === 'string'
          ? error.data
          : ((error as unknown as { message?: string }).message ??
            __('Could not save the topic. Please check your connection and try again.'))

      notificationApi?.error({ message: msg })
    },
    onSuccess: (response, payload) => {
      notificationApi?.success({
        description: slugDisclosure(payload.post_name, response.data?.post_name),
        message: __('Topic created successfully')
      })
      // Reload the list (page 1) with the currently active filters.
      void fetchAllPosts(usePostsStore.getState().filters)
      // This save just consumed a slug; a cached verdict from before it would
      // still call that slug free.
      queryClient.invalidateQueries({ queryKey: ['topic-slug-check'] })
    }
  })

  if (isError) {
    console.error(error)
  }

  return {
    isSavingTopic: isPending,
    saveTopic: mutateAsync
  }
}
