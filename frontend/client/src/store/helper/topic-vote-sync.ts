import { type Response } from '@common/helpers/request'
import { queryClient } from '@config/query-client'
import { type Topic } from '@features/topic-modal/shared/type'
import { type InfiniteData } from '@tanstack/react-query'

import { type FeedEntry, type UserComment } from '@/pages/User/data/use-user-content'

import { TOPIC_LIST_QUERY_KEY, type TopicsPage, type TopicsPagination } from '../data/fetch-all-posts-api'
import { type Vote } from './vote-flip'

/** Anything a profile tab can list — see `useUserContent`. */
type ProfileItem = FeedEntry | Topic | UserComment

interface CachedPage {
  data: ProfileItem[]
  pagination: TopicsPagination
}

const CONTENT_QUERY = { queryKey: ['user-content'] }

const LIST_QUERY = { queryKey: [...TOPIC_LIST_QUERY_KEY] }

const isFeedEntry = (item: ProfileItem): item is FeedEntry => 'kind' in item

const isTopic = (item: ProfileItem): item is Topic => 'ID' in item

/**
 * The topic a row is about, if it is the one being voted on.
 *
 * The overview feed wraps its topics; the topics and upvoted tabs list them
 * bare. Comments carry their own votes and never match.
 */
const matchedTopic = (item: ProfileItem, postId: number): Topic | undefined => {
  if (isFeedEntry(item)) {
    return item.kind === 'topic' && item.topic.ID === postId ? item.topic : undefined
  }

  return isTopic(item) && item.ID === postId ? item : undefined
}

const cachedPages = () => queryClient.getQueriesData<Response<CachedPage>>(CONTENT_QUERY)

const cachedLists = () => queryClient.getQueriesData<InfiniteData<TopicsPage>>(LIST_QUERY)

/**
 * A topic's vote as the portal listing or a member's profile currently has it.
 *
 * Neither the listing nor the profile tabs keep their topics in a store — they
 * are query data — so this is where a vote finds the state to flip. Without it
 * the button would have to wait for the server after all.
 */
export function readTopicVote(postId: number): undefined | Vote {
  for (const [, cached] of cachedLists()) {
    for (const page of cached?.pages ?? []) {
      const topic = page.topics.find(item => item.ID === postId)
      if (topic) return topic.vote
    }
  }

  for (const [, cached] of cachedPages()) {
    const items = cached?.data?.data
    if (!Array.isArray(items)) continue

    for (const item of items) {
      const topic = matchedTopic(item, postId)
      if (topic) return topic.vote
    }
  }

  return undefined
}

/**
 * Move a topic's vote button and count wherever the query cache is holding it.
 *
 * The topic page keeps its topic in a store and re-renders from it. The portal
 * listing (the `topics/list` queries) and a member's profile tabs (the
 * `user-content` query) do not, so every cached copy of the topic is moved here
 * — otherwise a vote updated the server and nothing else, and the button only
 * caught up on a reload.
 *
 * The cache is deliberately not invalidated: on the "Upvoted" tab a refetch
 * would drop the row the reader just un-voted out from under their cursor. What
 * gets written is the server's own total, so the page stays correct until the
 * next natural refetch replaces it.
 *
 * @param postId the topic voted on
 * @param vote the state to show — the guess made on click, then the state the
 *             server confirmed, or the original state again if it refused
 * @returns the topic's author id if a cached copy carried one — the caller needs
 *          it to move the author's upvote total, and has no copy of the topic
 *          of its own to read it from
 */
export function syncTopicVote(postId: number, vote: Vote): string | undefined {
  let author: string | undefined

  queryClient.setQueriesData<InfiniteData<TopicsPage>>(LIST_QUERY, previous => {
    if (!previous) return previous

    let changed = false

    const pages = previous.pages.map(page => {
      if (!page.topics.some(topic => topic.ID === postId)) return page

      changed = true

      return {
        ...page,
        topics: page.topics.map(topic => {
          if (topic.ID !== postId) return topic

          author ??= topic.post_author

          return { ...topic, vote }
        })
      }
    })

    return changed ? { ...previous, pages } : previous
  })

  queryClient.setQueriesData<Response<CachedPage>>(CONTENT_QUERY, previous => {
    const items = previous?.data?.data
    if (!previous || !Array.isArray(items)) return previous

    let changed = false

    const next = items.map(item => {
      const topic = matchedTopic(item, postId)
      if (!topic) return item

      changed = true
      author ??= topic.post_author

      return isFeedEntry(item) ? { ...item, topic: { ...topic, vote } } : { ...topic, vote }
    })

    // Same reference when nothing matched, so untouched tabs don't re-render.
    return changed ? { ...previous, data: { ...previous.data, data: next } } : previous
  })

  return author
}
