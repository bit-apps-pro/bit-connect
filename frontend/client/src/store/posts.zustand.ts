import { create } from 'zustand'

import { fetchAllPostsApi } from './data/fetch-all-posts-api'
import { toggleVoteApi } from './data/toggle-vote-api'
import { readTopicVote, syncTopicVote } from './helper/topic-vote-sync'
import { syncVotesReceived } from './helper/user-stats-sync'
import { flipVote, type Vote } from './helper/vote-flip'
import { type PostsFilters, type PostsStore } from './posts.type'

const TOPICS_PER_PAGE = 10

export const usePostsStore = create<PostsStore>((set, get) => ({
  error: undefined,
  filters: {},
  hasMore: false,
  isLoading: false,
  isLoadingMore: false,
  isVoting: false,
  page: 1,
  posts: [],
  total: 0,
  totalPages: 1,

  // Load the first page, replacing the list. Runs on mount and on filter change.
  fetchAllPosts: async (filters: PostsFilters = {}) => {
    set({ error: undefined, filters, isLoading: true })

    try {
      const { pagination, topics } = await fetchAllPostsApi({
        ...filters,
        page: 1,
        per_page: TOPICS_PER_PAGE
      })

      set({
        hasMore: pagination.current_page < pagination.total_pages,
        isLoading: false,
        page: pagination.current_page,
        posts: topics,
        total: pagination.total,
        totalPages: pagination.total_pages
      })
    } catch (error) {
      const errorMessage = (error as Error).message || 'Failed to fetch posts'
      set({ error: errorMessage, isLoading: false })
      throw error
    }
  },

  // Load the next page and append it (infinite scroll). Guards against
  // concurrent calls and stops once the last page is loaded.
  fetchMorePosts: async () => {
    const { filters, hasMore, isLoadingMore, page } = get()
    if (!hasMore || isLoadingMore) return

    set({ isLoadingMore: true })

    try {
      const { pagination, topics } = await fetchAllPostsApi({
        ...filters,
        page: page + 1,
        per_page: TOPICS_PER_PAGE
      })

      set(state => ({
        hasMore: pagination.current_page < pagination.total_pages,
        isLoadingMore: false,
        page: pagination.current_page,
        posts: [...state.posts, ...topics],
        total: pagination.total,
        totalPages: pagination.total_pages
      }))
    } catch (error) {
      const errorMessage = (error as Error).message || 'Failed to load more posts'
      set({ error: errorMessage, isLoadingMore: false })
      throw error
    }
  },

  toggleVote: async (postId: number) => {
    // Both copies move together: this list backs the portal, and the query cache
    // backs the profile tabs, which render the same card without reading this
    // store at all.
    const show = (vote: Vote) => {
      set(state => ({
        posts: state.posts.map(post => (post.ID === postId ? { ...post, vote } : post))
      }))

      return syncTopicVote(postId, vote)
    }

    const stored = get().posts.find(post => post.ID === postId)
    // A vote cast from a profile is on a topic this store never loaded.
    const before = stored?.vote ?? readTopicVote(postId)

    set({ isVoting: true })
    // Straight away, so the count answers the click rather than the round trip.
    if (before) show(flipVote(before))

    try {
      const voteData = await toggleVoteApi(postId)
      const author = show({ hasVoted: voteData.hasVoted, total: voteData.votes })

      set({ isVoting: false })

      // The author's own totals are cached elsewhere; move them in step with
      // the button rather than leaving their card a refresh behind.
      const authorId = stored?.post_author ?? author
      if (authorId) syncVotesReceived(authorId, voteData.hasVoted)
    } catch (error) {
      // Put back what the button showed before the click: the vote did not land,
      // and a count that stayed moved would claim otherwise.
      if (before) show(before)

      const errorMessage = (error as Error).message || 'Failed to vote on post'
      set({ error: errorMessage, isVoting: false })
      throw error
    }
  }
}))
