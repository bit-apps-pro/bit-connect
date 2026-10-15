import { type InfiniteData, useInfiniteQuery } from '@tanstack/react-query'
import { useEffect, useMemo } from 'react'

import { fetchAllPostsApi, TOPIC_LIST_QUERY_KEY, type TopicsPage } from '@/store/data/fetch-all-posts-api'
import { type PostsFilters } from '@/store/posts.type'

const TOPICS_PER_PAGE = 10

type TopicList = InfiniteData<TopicsPage, number>

/**
 * The list the portal showed last, whichever route showed it.
 *
 * `keepPreviousData` only bridges a filter change inside one mounted list, and
 * moving between the root listing and a stage's archive route mounts a new one
 * — so without this, opening a stage for the first time still blanked the page.
 */
let lastShown: TopicList | undefined

/**
 * The portal listing for one set of filters, a page at a time (infinite scroll).
 *
 * Each filter set is cached on its own, so going back to a stage you have
 * already opened shows its topics straight away and refreshes them behind the
 * scenes. A stage opened for the first time keeps the previous list on screen
 * (`isPlaceholderData`) until its own arrives, rather than blanking the page
 * to a loading line on every switch.
 */
export default function useTopics(filters: PostsFilters) {
  const query = useInfiniteQuery<TopicsPage, Error, TopicList, readonly unknown[], number>({
    getNextPageParam: ({ pagination }: TopicsPage) =>
      pagination.current_page < pagination.total_pages ? pagination.current_page + 1 : undefined,
    initialPageParam: 1,
    placeholderData: previous => previous ?? lastShown,
    queryFn: ({ pageParam }) => fetchAllPostsApi({ ...filters, page: pageParam, per_page: TOPICS_PER_PAGE }),
    queryKey: [...TOPIC_LIST_QUERY_KEY, filters]
  })

  const { data, isPlaceholderData } = query

  useEffect(() => {
    if (data && !isPlaceholderData) lastShown = data
  }, [data, isPlaceholderData])

  const posts = useMemo(() => data?.pages.flatMap(page => page.topics) ?? [], [data])

  return { ...query, posts }
}
