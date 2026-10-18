import { type Topic } from '@features/topic-modal/shared/type'
import getRequest from '@utils/request/get'

import { type PostsFilters } from '../posts.type'

export interface TopicsPagination {
  current_page: number
  per_page: number
  total: number
  total_pages: number
}

interface TopicsResponseData {
  data: Topic[]
  pagination: TopicsPagination
}

export interface TopicsPage {
  pagination: TopicsPagination
  topics: Topic[]
}

/**
 * Root of the portal listing's query keys — one entry per filter set under it.
 *
 * Under `topics` so saving an edited topic, which invalidates `['topics']`,
 * refreshes every cached list too.
 */
export const TOPIC_LIST_QUERY_KEY = ['topics', 'list'] as const

/**
 * Fetch a single page of topics with optional filters.
 * @param filters - Optional filters for searching/sorting (page is taken from here)
 * @returns Promise<TopicsPage> - The page of topics plus pagination metadata
 */
export async function fetchAllPostsApi(filters?: PostsFilters): Promise<TopicsPage> {
  const response = await getRequest<TopicsResponseData>('topics', {
    queryParam: (filters || {}) as Record<string, number | string>
  })

  const { data, pagination } = response.data

  return {
    pagination: pagination ?? {
      current_page: 1,
      per_page: data?.length ?? 0,
      total: data?.length ?? 0,
      total_pages: 1
    },
    topics: data || []
  }
}
