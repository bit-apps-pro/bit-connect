import NotifyContext from '@common/context/NotifyContext'
import { __ } from '@common/helpers/i18nWrap'
import { type Response } from '@common/helpers/request'
import { wpApi } from '@common/request/wp-api'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useContext } from 'react'

import { type Tag } from '../shared/types'

export interface ErrorResponse {
  errors: { message: string }
}

export default function useStoreTag() {
  const queryClient = useQueryClient()
  const { messageApi } = useContext(NotifyContext)

  const { error, isError, isPending, mutateAsync } = useMutation<Response<Tag>, ErrorResponse, Tag>({
    mutationFn: tagData => {
      return wpApi('bit-connect-tags', { body: tagData, method: 'POST' })
    },
    mutationKey: ['tags', 'store'],
    onSuccess: () => {
      messageApi?.success(__('Tag created successfully'))
      queryClient.invalidateQueries({ queryKey: ['tags'] })
    }
  })

  return {
    error: error,
    isError: isError,
    isStoringTag: isPending,
    storeTag: mutateAsync
  }
}
