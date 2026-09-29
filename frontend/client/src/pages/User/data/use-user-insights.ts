import queryRequest, { type Response as ApiResponse } from '@common/helpers/request'
import { keepPreviousData, useQuery } from '@tanstack/react-query'

/** The windows the Overview offers. Mirrors UserInsightsService::PERIODS. */
export const INSIGHT_PERIODS = ['7d', '30d', '12m', 'all'] as const

export type InsightPeriod = (typeof INSIGHT_PERIODS)[number]

export interface InsightTerm {
  /** The colour an admin gave the topic type, or null when they gave none. */
  color: null | string
  name: string
  term_id: number
}

export interface InsightTopic {
  comments: number
  ID: number
  post_name: string
  post_title: string
  topic_type: InsightTerm | null
  votes: number
}

export interface UserInsights {
  breakdown: (InsightTerm & { count: number })[]
  period: InsightPeriod
  top_topics: InsightTopic[]
  totals: { comments: number; topics: number; votes_received: number }
}

/**
 * A member's activity over a period: totals, their most-voted topics and how
 * their topics split across topic types.
 */
export default function useUserInsights(
  userId: number | undefined,
  period: InsightPeriod,
  { enabled = true }: { enabled?: boolean } = {}
) {
  const id = Number(userId)

  const { data, isFetching, isLoading } = useQuery({
    enabled: enabled && Number.isFinite(id) && id > 0,
    // Keeps the last period's figures up while the next one loads, so changing
    // the range dims the numbers rather than collapsing them to skeletons.
    placeholderData: keepPreviousData,
    queryFn: async ({ signal }) =>
      queryRequest<UserInsights>(`users/${id}/insights`, {}, { period }, 'GET', { signal }),
    queryKey: ['user-insights', id, period],
    retry: false,
    select: (res: ApiResponse<UserInsights>) => res?.data,
    staleTime: 60 * 1000
  })

  return { insights: data, isFetchingInsights: isFetching, isLoadingInsights: isLoading }
}
