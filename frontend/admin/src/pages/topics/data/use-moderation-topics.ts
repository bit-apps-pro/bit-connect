import { request } from '@common/request'
import { type QueryParam, type ResponseType } from '@common/request/types'
import { keepPreviousData, useQuery } from '@tanstack/react-query'

import { type ModerationTopicsPage, type TopicFilters } from '../shared/types'

/** Every cached page of the table; mutations invalidate under this. */
export const MODERATION_TOPICS_KEY = ['moderation-topics']

/**
 * The filters as query parameters, unset ones left out.
 *
 * The added taxonomies travel flat, under their own parameter, the way the
 * server reads them.
 */
export function toQueryParam(filters: TopicFilters, view: string): QueryParam {
  const { terms, ...own } = filters
  const query: QueryParam = {}

  for (const [key, value] of Object.entries({ ...own, ...terms })) {
    if (value !== undefined && value !== '' && value !== 0) query[key] = value as number | string
  }

  if (view) query.view = view

  return query
}

/**
 * The response with every part the table walks guaranteed to be walkable, so
 * a body of any other shape becomes an empty table rather than a blank screen.
 */
export function asPage(response: ResponseType<ModerationTopicsPage> | undefined): ModerationTopicsPage {
  const body = response?.data
  const pagination = body?.pagination

  return {
    data: Array.isArray(body?.data) ? body.data : [],
    pagination: {
      current_page: Number(pagination?.current_page) || 1,
      per_page: Number(pagination?.per_page) || 20,
      total: Number(pagination?.total) || 0,
      total_pages: Number(pagination?.total_pages) || 0
    }
  }
}

export function fetchModerationTopics(filters: TopicFilters, view: string, signal?: AbortSignal) {
  return request<never, ModerationTopicsPage>('moderation/topics', {
    method: 'GET',
    queryParam: toQueryParam(filters, view),
    signal
  })
}

export default function useModerationTopics(filters: TopicFilters, view: string) {
  const { data, isError, isFetching } = useQuery<
    ResponseType<ModerationTopicsPage>,
    Error,
    ModerationTopicsPage
  >({
    // The previous page stays on screen, dimmed, until the next one arrives.
    placeholderData: keepPreviousData,
    queryFn: ({ signal }) => fetchModerationTopics(filters, view, signal),
    queryKey: [...MODERATION_TOPICS_KEY, view, filters],
    retry: false,
    select: asPage
  })

  return { isTopicsError: isError, isTopicsFetching: isFetching, topics: data }
}
