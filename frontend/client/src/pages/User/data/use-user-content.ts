import queryRequest, { type Response as ApiResponse } from '@common/helpers/request'
import { type Topic } from '@features/topic-modal/shared/type'
import { useQuery } from '@tanstack/react-query'

import { type TopicsPagination } from '@/store/data/fetch-all-posts-api'

/** How many rows each profile tab loads at a time. */
export const PROFILE_PAGE_SIZE = 10

/**
 * A comment as it appears on a profile: the comment itself plus just enough of
 * its topic to render a link back. Deliberately narrower than the comment shape
 * used on a topic page, which carries author email and IP.
 */
export interface UserComment {
  comment_content: string
  comment_date_gmt: string
  comment_ID: number
  comment_post_ID: number
  post_name: string
  post_title: string
  vote: null | { hasVoted: boolean; total: number }
}

interface Paged<T> {
  data: T[]
  pagination: TopicsPagination
}

/** Which list a profile tab shows. Matches the endpoint segment. */
export type ProfileTab = 'comments' | 'overview' | 'topics' | 'votes'

/**
 * One entry in the merged overview feed — a topic the member wrote or a comment
 * they left, tagged so the row can render the right shape.
 */
export type FeedEntry =
  | { comment: UserComment; kind: 'comment'; occurred_at: string }
  | { kind: 'topic'; occurred_at: string; topic: Topic }

const EMPTY_PAGINATION: TopicsPagination = {
  current_page: 1,
  per_page: PROFILE_PAGE_SIZE,
  total: 0,
  total_pages: 1
}

/**
 * One page of a member's topics, comments or upvoted topics.
 *
 * `votes` is owner/moderator-only server-side; the caller is responsible for
 * not offering the tab to anyone else, and a request that slips through is
 * rejected rather than served.
 */
export default function useUserContent<T = FeedEntry | Topic | UserComment>(
  userId: number | string | undefined,
  tab: ProfileTab,
  page: number,
  { enabled = true }: { enabled?: boolean } = {}
) {
  const id = Number(userId)
  const isValidUser = Number.isFinite(id) && id > 0

  const { data, isFetching, isLoading } = useQuery({
    enabled: enabled && isValidUser,
    // Keeps the previous page on screen while the next one loads, so paging
    // doesn't collapse the list to a spinner and jump the scroll position.
    //
    // Scoped to the same tab: held across tabs it would hand the comments list
    // the topics it was showing a moment ago, and those have none of the fields
    // a comment row reads.
    placeholderData: (previous, previousQuery) =>
      previousQuery?.queryKey?.[2] === tab ? previous : undefined,
    queryFn: async ({ signal }) =>
      queryRequest<Paged<T>>(`users/${id}/${tab}`, {}, { page, per_page: PROFILE_PAGE_SIZE }, 'GET', {
        signal
      }),
    queryKey: ['user-content', id, tab, page],
    retry: false,
    // Annotated because `placeholderData` plus the generic `T` leaves TanStack
    // unable to infer the query's data type on its own.
    select: (res: ApiResponse<Paged<T>>) => res?.data,
    staleTime: 60 * 1000
  })

  return {
    isFetchingItems: isFetching,
    isLoadingItems: isLoading,
    items: data?.data ?? [],
    pagination: data?.pagination ?? EMPTY_PAGINATION
  }
}
