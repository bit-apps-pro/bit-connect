import NotifyContext from '@common/context/NotifyContext'
import { __ } from '@common/helpers/i18nWrap'
import { type Response } from '@common/helpers/request'
import { wpApi } from '@common/request/wp-api'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useContext } from 'react'

import { type Tag, type TagFormData } from '../shared/types'
import { type ErrorResponse } from './use-store-tag'

interface UpdateTagData extends TagFormData {
  id: number
}

export default function useUpdateTag() {
  const queryClient = useQueryClient()
  const { messageApi } = useContext(NotifyContext)

  const { error, isError, isPending, mutateAsync } = useMutation<
    Response<Tag>,
    ErrorResponse,
    UpdateTagData
  >({
    mutationFn: ({ id, ...stageData }) => {
      return wpApi<UpdateTagData, Tag>(`bit-connect-tags/${id}`, {
        body: { id, ...stageData },
        method: 'PUT'
      })
    },
    mutationKey: ['tags', 'update'],
    onError: () => {
      messageApi?.error(__('Failed to update tag'))
    },
    onSuccess: () => {
      messageApi?.success(__('Tag updated successfully'))
      queryClient.invalidateQueries({ queryKey: ['tags'] })
    }
  })

  return {
    error: error,
    isError: isError,
    isUpdatingTag: isPending,
    updateTag: mutateAsync
  }
}
