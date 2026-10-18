import { request } from '@common/request'
import { type ResponseType } from '@common/request/types'
import { keepPreviousData, useQuery } from '@tanstack/react-query'

import { type DashboardData, type DashboardPeriod } from '../shared/types'

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
    // Retried quietly behind the skeleton, like the settings screens.
    retry: 2,
    select: response => response?.data
  })

  return {
    dashboard: data,
    isDashboardError: isError,
    isDashboardPending: isPending,
    isDashboardStale: isPlaceholderData,
    refetchDashboard: refetch
  }
}
