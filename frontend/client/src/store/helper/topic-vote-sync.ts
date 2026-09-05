import { type Response } from '@common/helpers/request'
import { queryClient } from '@config/query-client'
import { type Topic } from '@features/topic-modal/shared/type'

import { type FeedEntry, type UserComment } from '@/pages/User/data/use-user-content'

import { type TopicsPagination } from '../data/fetch-all-posts-api'
import { type Vote } from './vote-flip'

/** Anything a profile tab can list — see `useUserContent`. */
type ProfileItem = FeedEntry | Topic | UserComment

interface CachedPage {
  data: ProfileItem[]
  pagination: TopicsPagination
}

const CONTENT_QUERY = { queryKey: ['user-content'] }

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

/**
 * A topic's vote as a member's profile currently has it.
 *
 * The vote stores only hold the topics they loaded themselves, and a vote cast
 * from a profile is on a topic they never loaded — without this there would be
 * nothing to flip, and the button would have to wait for the server after all.
 */
export function readTopicVote(postId: number): undefined | Vote {
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
 * The vote stores keep their own list of topics and re-render from it, which
 * covers the portal listing and the topic page. A member's profile does not read
 * those stores — its tabs come from the `user-content` query — so a vote cast
 * from a profile updated the server and nothing else, and the button only caught
 * up on a reload.
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
 *          it to move the author's upvote total, and on a profile page the vote
 *          store has no copy of the topic to read it from
 */
export function syncTopicVote(postId: number, vote: Vote): string | undefined {
  let author: string | undefined

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
