import { type ResponseType } from '@common/request/types'
import { wpApi } from '@common/request/wp-api'
import { useQuery } from '@tanstack/react-query'
import { sortByOrder } from '@utilities/term-order'
import { useCallback } from 'react'

import { type Status } from '../shared/types'

/** Query key of the status list; shared so mutations invalidate the right one. */
export const STATUSES_QUERY_KEY = ['bit-connect-statuses']

/**
 * Shared so an empty result keeps the same identity between renders. The table
 * mirrors this array into local state to reorder it optimistically, and a fresh
 * `[]` each render would resync — and undo the drag — on every render.
 */
const NO_STATUSES: Status[] = []

export default function useStatuses() {
  // Memoised for the same reason: react-query re-runs `select` whenever the
  // function identity changes, which for an inline arrow is every render.
  const select = useCallback((response: ResponseType<Status[]>) => {
    const statuses = response?.data ?? response
    if (Array.isArray(statuses)) {
      return sortByOrder(statuses.map(status => ({ ...status, meta: status.meta || {} })))
    }
    return NO_STATUSES
  }, [])

  const { data, isError, isFetching, isPending, refetch } = useQuery<
    ResponseType<Status[]>,
    Error,
    Status[]
  >({
    queryFn: ({ signal }) =>
      wpApi('bit-connect-statuses', { method: 'GET', queryParam: { per_page: 100 }, signal }),
    queryKey: STATUSES_QUERY_KEY,
    select
  })

  return {
    isStatusesError: isError,
    isStatusesFetching: isFetching,
    isStatusesPending: isPending,
    refetchStatuses: refetch,
    statuses: isError ? NO_STATUSES : (data ?? NO_STATUSES)
  }
}
