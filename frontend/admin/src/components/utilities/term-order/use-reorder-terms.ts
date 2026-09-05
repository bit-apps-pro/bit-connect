import NotifyContext from '@common/context/NotifyContext'
import { __ } from '@common/helpers/i18nWrap'
import { type Response } from '@common/helpers/request'
import { request } from '@common/request'
import { type QueryKey, useMutation, useQueryClient } from '@tanstack/react-query'
import { useContext } from 'react'

interface ReorderBody {
  ids: number[]
}

interface ReorderedTerm {
  id: number
  name: string
  order: number
  slug: string
}

interface ErrorResponse {
  errors: { message: string }
}

/**
 * Persist a new order for one taxonomy's terms.
 *
 * @param taxonomy the taxonomy slug, e.g. `bit-connect-stages`
 * @param listKey  query key of the list to refresh once the order is stored
 */
export default function useReorderTerms(taxonomy: string, listKey: QueryKey) {
  const queryClient = useQueryClient()
  const { messageApi } = useContext(NotifyContext)

  const { error, isError, isPending, mutateAsync } = useMutation<
    Response<ReorderedTerm[]>,
    ErrorResponse,
    number[]
  >({
    mutationFn: ids =>
      request<ReorderBody, ReorderedTerm[]>(`taxonomies/${taxonomy}/reorder`, {
        body: { ids },
        method: 'POST'
      }),
    mutationKey: [taxonomy, 'reorder'],
    onError: () => {
      messageApi?.error(__('Failed to save the new order'))
    },
    // Refetch either way: on success to pick up the stored positions, and on
    // failure to undo the optimistic order the table is already showing.
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: listKey })
    }
  })

  return {
    error,
    isError,
    isReorderingTerms: isPending,
    reorderTerms: mutateAsync
  }
}
