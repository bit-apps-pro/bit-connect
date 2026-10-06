import NotifyContext from '@common/context/NotifyContext'
import { __, sprintf } from '@common/helpers/i18nWrap'
import { type Response } from '@common/helpers/request'
import { request } from '@common/request'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useContext } from 'react'

import { type ErrorResponse } from './use-store-tag'

interface MergeBody {
  from: number
  into: number
}

/** What the merge did — see TermMergeService. */
interface MergeResult {
  followers: number
  moved: number
}

/**
 * Fold one tag into another: its topics are re-filed under the survivor, its
 * followers move across, and then it is deleted. A plugin route rather than
 * core's terms endpoint, which can delete a term but not re-file it first.
 */
export default function useMergeTag() {
  const queryClient = useQueryClient()
  const { messageApi } = useContext(NotifyContext)

  const { error, isError, isPending, mutateAsync } = useMutation<Response<MergeResult>, ErrorResponse, MergeBody>({
    mutationFn: body =>
      request<MergeBody, MergeResult>('taxonomies/bit-connect-tags/merge', { body, method: 'POST' }),
    mutationKey: ['tags', 'merge'],
    onError: err => {
      messageApi?.error(err?.errors?.message || __('Failed to merge the tag'))
    },
    onSuccess: response => {
      const moved = response?.data?.moved ?? 0
      messageApi?.success(
        // translators: %s: number of topics
        sprintf(__('Tag merged. %s topics were re-filed.'), String(moved))
      )
      queryClient.invalidateQueries({ queryKey: ['tags'] })
    }
  })

  return {
    error,
    isError,
    isMergingTag: isPending,
    mergeTag: mutateAsync
  }
}
