import { request } from '@common/request'
import { type QueryParam, type ResponseType } from '@common/request/types'
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

export interface ReportQueueEntry {
  count: number
  /** Every explanation reporters wrote, in the order they were filed. */
  details: string[]
  excerpt: string
  /** False once the reported item has been removed. */
  exists: boolean
  first_at: string
  latest_at: string
  link: string
  reason_labels: Record<string, string>
  /** reason slug => how many people gave it. */
  reasons: Record<string, number>
  reporters: { id: number; name: string }[]
  target_author: number
  target_author_name: string
  target_id: number
  target_type: string
  title: string
}

interface ReportsResponse {
  data: ReportQueueEntry[]
  pagination: {
    current_page: number
    per_page: number
    total: number
    total_pages: number
  }
  /** True when the queue hit its read cap and there is more behind it. */
  truncated: boolean
}

export interface ReportsFilters {
  page?: number
  per_page?: number
  status?: string
}

export function useReports(filters: ReportsFilters) {
  const { data, isError, isFetching, isPlaceholderData } = useQuery<
    ResponseType<ReportsResponse>,
    Error,
    ReportsResponse
  >({
    placeholderData: keepPreviousData,
    queryFn: ({ signal }) =>
      request<never, ReportsResponse>('reports', {
        method: 'GET',
        queryParam: filters as QueryParam,
        signal
      }),
    queryKey: ['reports', filters],
    retry: false,
    select: response => response?.data
  })

  return {
    isReportsError: isError,
    isReportsFetching: isFetching,
    // True only while another tab or page is loading behind the one on screen.
    // `isFetching` cannot tell those apart from the refetch that follows a
    // decision, and dimming the list for that one would grey out the very card
    // the moderator is watching leave.
    isReportsStale: isPlaceholderData,
    reports: data
  }
}

interface ResolvePayload {
  note?: string
  status: string
  target_id: number
  target_type: string
}

interface ResolveResult {
  closed: number
  /** True when the decision deleted the content rather than leaving it hidden. */
  removed?: boolean
  /** True when the decision put hidden content back in public view. */
  restored?: boolean
  status: string
}

/**
 * Drops one resolved target from a cached queue page.
 *
 * Returns the cache untouched when the target is not in it, which is what makes
 * this safe to run across every cached page at once: the tab the item is moving
 * *to* has no row to remove, so its total is left alone rather than quietly
 * losing one.
 */
function withoutTarget(
  cached: ResponseType<ReportsResponse> | undefined,
  target: Pick<ResolvePayload, 'target_id' | 'target_type'>
) {
  const entries = cached?.data?.data

  if (!entries) return cached

  const kept = entries.filter(
    entry => entry.target_id !== target.target_id || entry.target_type !== target.target_type
  )

  if (kept.length === entries.length) return cached

  return {
    ...cached,
    data: {
      ...cached.data,
      data: kept,
      pagination: {
        ...cached.data.pagination,
        total: Math.max(0, cached.data.pagination.total - 1)
      }
    }
  }
}

export function useResolveReport() {
  const queryClient = useQueryClient()

  const { isPending, mutateAsync } = useMutation({
    mutationFn: (payload: ResolvePayload) =>
      request<ResolvePayload, ResolveResult>('reports/resolve', {
        body: payload,
        method: 'POST'
      }),
    onSuccess: (_response, payload) => {
      // Taken out of the cache the moment the server confirms, rather than a
      // round trip later when the refetch lands. The card's exit animation is
      // the receipt for the decision, and a receipt that arrives after a
      // network wait reads as the button having done nothing.
      queryClient.setQueriesData<ResponseType<ReportsResponse>>({ queryKey: ['reports'] }, cached =>
        withoutTarget(cached, payload)
      )

      // Still refetched: the entry has to appear on whichever tab it moved to,
      // and the counts on every other page are now off by one.
      return queryClient.invalidateQueries({ queryKey: ['reports'] })
    }
  })

  return { isResolving: isPending, resolve: mutateAsync }
}
