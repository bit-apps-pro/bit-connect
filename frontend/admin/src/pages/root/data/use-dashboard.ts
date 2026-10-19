import NotifyContext from '@common/context/NotifyContext'
import { __ } from '@common/helpers/i18nWrap'
import { request } from '@common/request'
import { type ResponseType } from '@common/request/types'
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useContext } from 'react'

import { type DashboardData, type DashboardPeriod } from '../shared/types'

/**
 * `request()` wraps a failed fetch, or a body that is not JSON, as
 * `{ errors: <Error> }`. A body the server sent back is thrown as itself.
 */
function isTransportFailure(error: unknown): boolean {
  return !!error && typeof error === 'object' && 'errors' in error && error.errors instanceof Error
}

export default function useDashboard(period: DashboardPeriod) {
  const { data, isError, isPending, isPlaceholderData, refetch } = useQuery<
    ResponseType<DashboardData>,
    Error,
    DashboardData
  >({
    // The last period stays on screen, dimmed, while the next one loads —
    // swapping every card for a skeleton on each switch reads as a reload.
    placeholderData: keepPreviousData,
    queryFn: ({ signal }) =>
      request<never, DashboardData>('dashboard', { method: 'GET', queryParam: { period }, signal }),
    queryKey: ['dashboard', period],
    // Retried quietly behind the skeleton, but only when the request never got
    // an answer. A server that answered with an error — a 500 from a host out
    // of memory — fails the same way again, and each retry costs it as much.
    retry: (failureCount, error) => failureCount < 2 && isTransportFailure(error),
    select: response => response?.data
  })

  // The server keeps its answer for a few minutes. Refresh asks it to compute
  // again, and the answer replaces the cached one on screen.
  const queryClient = useQueryClient()
  const { messageApi } = useContext(NotifyContext)
  const { isPending: isRefreshing, mutate: refresh } = useMutation({
    mutationFn: () =>
      request<never, DashboardData>('dashboard', { method: 'GET', queryParam: { fresh: 1, period } }),
    // The numbers on screen stay; only the attempt failed.
    onError: () => {
      messageApi?.error(__('The dashboard could not be refreshed.'))
    },
    onSuccess: response => {
      queryClient.setQueryData(['dashboard', period], response)
      // The server dropped every period; the ones held here are older still.
      queryClient.invalidateQueries({
        predicate: query => query.queryKey[0] === 'dashboard' && query.queryKey[1] !== period,
        refetchType: 'none'
      })
    }
  })

  return {
    dashboard: data,
    isDashboardError: isError,
    isDashboardPending: isPending,
    isDashboardRefreshing: isRefreshing,
    isDashboardStale: isPlaceholderData,
    refetchDashboard: refetch,
    refreshDashboard: () => refresh()
  }
}
