import { create } from 'zustand'

import { toggleVoteApi } from './data/toggle-vote-api'
import { readTopicVote, syncTopicVote } from './helper/topic-vote-sync'
import { syncVotesReceived } from './helper/user-stats-sync'
import { flipVote } from './helper/vote-flip'
import { type PostsStore } from './posts.type'

/**
 * Voting on a topic from a list — the portal listing, a profile tab, Following.
 *
 * The lists themselves are query data (see `useTopics`, `useUserContent`), so a
 * vote moves the cached copies of the topic rather than a list held here.
 */
export const usePostsStore = create<PostsStore>(set => ({
  error: undefined,
  isVoting: false,

  toggleVote: async (postId: number) => {
    const before = readTopicVote(postId)

    set({ isVoting: true })
    // Straight away, so the count answers the click rather than the round trip.
    if (before) syncTopicVote(postId, flipVote(before))

    try {
      const voteData = await toggleVoteApi(postId)
      const author = syncTopicVote(postId, { hasVoted: voteData.hasVoted, total: voteData.votes })

      set({ isVoting: false })

      // The author's own totals are cached elsewhere; move them in step with
      // the button rather than leaving their card a refresh behind.
      if (author) syncVotesReceived(author, voteData.hasVoted)
    } catch (error) {
      // Put back what the button showed before the click: the vote did not land,
      // and a count that stayed moved would claim otherwise.
      if (before) syncTopicVote(postId, before)

      const errorMessage = (error as Error).message || 'Failed to vote on post'
      set({ error: errorMessage, isVoting: false })
      throw error
    }
  }
}))
