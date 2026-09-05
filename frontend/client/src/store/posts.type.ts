import { type Topic } from '@features/topic-modal/shared/type'

export interface PostsStore {
  error: string | undefined
  /** Load the first page, replacing the list. Use on mount and when filters change. */
  fetchAllPosts: (filters?: PostsFilters) => Promise<void>
  /** Load the next page and append it to the list (infinite scroll). */
  fetchMorePosts: () => Promise<void>
  /** Filters used for the currently loaded list (so fetchMorePosts can reuse them). */
  filters: PostsFilters
  /** Whether more pages remain to be loaded. */
  hasMore: boolean
  /** Initial / filter-change load in progress. */
  isLoading: boolean
  /** Appending the next page in progress. */
  isLoadingMore: boolean
  isVoting: boolean
  /** Current loaded page number. */
  page: number
  posts: Topic[]
  toggleVote: (postId: number) => Promise<void>
  /** Total topics across all pages. */
  total: number
  totalPages: number
}

export interface PostsFilters {
  departments?: string
  my_topics?: string
  page?: number
  per_page?: number
  search?: string
  sortBy?: string
  stages?: string
  statuses?: string
  tags?: string
  'topic-types'?: string
  visibility?: string
}
