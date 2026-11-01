import { type Topic } from '@features/topic-modal/shared/type'
import { type InfiniteData } from '@tanstack/react-query'
import { decodeSlug, isSameSlug } from '@utils/slug'

import { queryClient } from '@/config/query-client'
import { type TopicComment } from '@/types/wordpress-post'

import { TOPIC_LIST_QUERY_KEY, type TopicsPage } from '../data/fetch-all-posts-api'
import { fetchCommentsApi } from '../data/fetch-comments-api'
import { fetchPostByNameApi } from '../data/fetch-post-api'
import { type SortOption } from '../single-post.type'

/**
 * The query cache behind the topic page.
 *
 * The page itself still reads from the single-post store, because votes, pins,
 * locks and comment edits all write there, and other plugins write there too.
 * The store is the page's live state; this is its memory. Each topic and each
 * first page of comments is kept here, so opening a topic a second time shows
 * it at once, and a topic clicked in the list starts from the copy the list
 * already holds.
 */

export const COMMENTS_PER_PAGE = 10

/**
 * How long a cached topic or comment page is shown without a new request. The
 * same as the client's default, so the topic page and the lists age together.
 */
export const TOPIC_STALE_TIME = 30_000

/**
 * Under `topics`, so the `['topics']` invalidation an edit already sends marks
 * the open topic stale too. Keyed by the decoded slug: the router gives the
 * decoded form and the server gives the encoded one.
 */
export const topicQueryKey = (slug: string) => ['topics', 'detail', decodeSlug(slug)] as const

export const topicCommentsQueryKey = (topicId: number, sort: SortOption) =>
  ['topic-comments', topicId, sort] as const

/** The comment threads loaded for one topic and one sort, and how far they reach. */
export interface CommentsSnapshot {
  comments: TopicComment[]
  page: number
  totalPages: number
}

/**
 * Fetch the topic, or answer from the cache while the copy is fresh. Two calls
 * at the same time share one request.
 */
export const fetchTopic = (slug: string): Promise<Topic> =>
  queryClient.fetchQuery({
    queryFn: () => fetchPostByNameApi(slug),
    queryKey: topicQueryKey(slug)
  })

/** Fetch page 1 of a topic's comments. Two calls at the same time share one request. */
export const fetchFirstCommentsPage = (topicId: number, sort: SortOption): Promise<CommentsSnapshot> =>
  queryClient.fetchQuery({
    queryFn: async () => {
      const { comments, pagination } = await fetchCommentsApi(topicId, {
        page: 1,
        perPage: COMMENTS_PER_PAGE,
        sort
      })

      return { comments, page: pagination.current_page, totalPages: pagination.total_pages }
    },
    queryKey: topicCommentsQueryKey(topicId, sort),
    // The store decides when a cached page is good enough (see cachedComments);
    // when it asks, it wants the server's answer.
    staleTime: 0
  })

/** The same topic in a cached list page, if the reader came from one. */
const findListedTopic = (slug: string): Topic | undefined => {
  for (const [, list] of queryClient.getQueriesData<InfiniteData<TopicsPage>>({
    queryKey: TOPIC_LIST_QUERY_KEY
  })) {
    for (const page of list?.pages ?? []) {
      const topic = page.topics.find(item => isSameSlug(item.post_name, slug))
      if (topic) return topic
    }
  }

  return undefined
}

/**
 * A copy of the topic to show while the real one loads.
 *
 * The list copy has every field the page draws except `following`, which the
 * follow control takes over once the full topic arrives.
 */
export const cachedTopic = (slug: string): Topic | undefined =>
  queryClient.getQueryData<Topic>(topicQueryKey(slug)) ?? findListedTopic(slug)

/** The comments last loaded for this topic and sort, and whether they are still fresh. */
export const cachedComments = (topicId: number, sort: SortOption) => {
  const key = topicCommentsQueryKey(topicId, sort)
  const snapshot = queryClient.getQueryData<CommentsSnapshot>(key)
  if (!snapshot) return

  const state = queryClient.getQueryState(key)
  const fresh = !state?.isInvalidated && Date.now() - (state?.dataUpdatedAt ?? 0) < TOPIC_STALE_TIME

  return { fresh, snapshot }
}

/**
 * Write a change the reader made into an entry that is already cached.
 *
 * Only an existing entry: a copy that did not come from the server (the list's
 * seed) must not be stored as though it did. The entry keeps its age, so a vote
 * does not make an old copy count as fresh.
 */
const updateExisting = <T>(key: readonly unknown[], value: T) => {
  const state = queryClient.getQueryState<T>(key)
  if (state?.data === undefined) return

  queryClient.setQueryData<T>(key, value, { updatedAt: state.dataUpdatedAt })
}

export const rememberTopic = (topic: Topic) => updateExisting(topicQueryKey(topic.post_name), topic)

export const rememberComments = (topicId: number, sort: SortOption, snapshot: CommentsSnapshot) =>
  updateExisting(topicCommentsQueryKey(topicId, sort), snapshot)

/**
 * Ask the server again next time, for a change the store does not hold — the
 * follow state, which a comment or the Follow control moves on the server.
 */
export const markTopicsStale = () => queryClient.invalidateQueries({ queryKey: ['topics', 'detail'] })

/** Drop a topic that no longer exists, with its comments. */
export const forgetTopic = (topic: Pick<Topic, 'ID' | 'post_name'>) => {
  queryClient.removeQueries({ queryKey: topicQueryKey(topic.post_name) })
  queryClient.removeQueries({ queryKey: ['topic-comments', topic.ID] })
}

/**
 * Load a topic and its first comments before the reader opens it.
 *
 * Both go through the same fetches the page uses, so an open that follows
 * finds them in the cache. A fresh copy is not fetched again.
 */
export const prefetchTopic = (topic: Pick<Topic, 'ID' | 'post_name'>, sort: SortOption) => {
  void queryClient.prefetchQuery({
    queryFn: () => fetchPostByNameApi(topic.post_name),
    queryKey: topicQueryKey(topic.post_name),
    staleTime: TOPIC_STALE_TIME
  })

  if (cachedComments(topic.ID, sort)?.fresh) return
  void fetchFirstCommentsPage(topic.ID, sort).catch(() => {
    // Only a head start. The page asks again when it opens.
  })
}
