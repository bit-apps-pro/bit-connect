import queryRequest from '@common/helpers/request'
import { useQuery } from '@tanstack/react-query'

export interface UserStats {
  comments: number
  registered_at: string
  topics: number
  votes_received: number
}

/**
 * Public contribution totals for a portal member.
 *
 * Cached for the session: the same author's card renders on every topic they
 * wrote, and these numbers move slowly.
 */
export default function useUserStats(userId: number | string | undefined) {
  const id = Number(userId)
  const enabled = Number.isFinite(id) && id > 0

  const { data, isLoading } = useQuery({
    enabled,
    queryFn: async ({ signal }) =>
      queryRequest<UserStats>(`users/${id}/stats`, {}, undefined, 'GET', { signal }),
    queryKey: ['user-stats', id],
    select: res => res?.data,
    staleTime: 5 * 60 * 1000
  })

  return { isLoadingStats: isLoading, stats: data }
}
