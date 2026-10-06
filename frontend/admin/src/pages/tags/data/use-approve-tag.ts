import NotifyContext from '@common/context/NotifyContext'
import { __ } from '@common/helpers/i18nWrap'
import { type Response } from '@common/helpers/request'
import { request } from '@common/request'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useContext } from 'react'

import { type ErrorResponse } from './use-store-tag'

/**
 * Let a member-suggested tag into the vocabulary. The flag comes off; the
 * tag, its topics and who suggested it stay as they are.
 */
export default function useApproveTag() {
  const queryClient = useQueryClient()
  const { messageApi } = useContext(NotifyContext)

  const { isPending, mutateAsync } = useMutation<Response<{ id: number }>, ErrorResponse, number>({
    mutationFn: id => request<{ id: number }, { id: number }>('taxonomies/tags/approve', { body: { id }, method: 'POST' }),
    mutationKey: ['tags', 'approve'],
    onError: err => {
      messageApi?.error(err?.errors?.message || __('Failed to approve the tag'))
    },
    onSuccess: () => {
      messageApi?.success(__('Tag approved'))
      queryClient.invalidateQueries({ queryKey: ['tags'] })
    }
  })

  return { approveTag: mutateAsync, isApprovingTag: isPending }
}
