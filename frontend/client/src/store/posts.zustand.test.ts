import { type Response } from '@common/helpers/request'
import { queryClient } from '@config/query-client'
import { type Topic } from '@features/topic-modal/shared/type'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { toggleVoteApi } from './data/toggle-vote-api'
import { usePostsStore } from './posts.zustand'

vi.mock('./data/toggle-vote-api', () => ({ toggleVoteApi: vi.fn() }))

const makeTopic = (id: number, total: number, hasVoted = false): Topic =>
  ({
    ID: id,
    post_author: '7',
    post_name: `topic-${id}`,
    post_title: `Topic ${id}`,
    vote: { hasVoted, total }
  }) as Topic

/** A request that has been sent but has not come back yet. */
const pendingVote = () => {
  let settle!: (value: { hasVoted: boolean; votes: number }) => void
  const promise = new Promise<{ hasVoted: boolean; votes: number }>(resolve => {
    settle = resolve
  })

  vi.mocked(toggleVoteApi).mockReturnValue(promise)

  return settle
}

const seedProfilePage = (items: Topic[]) => {
  queryClient.setQueryData(['user-content', 7, 'topics', 1], {
    code: 'SUCCESS',
    data: {
      data: items,
      pagination: { current_page: 1, per_page: 10, total: items.length, total_pages: 1 }
    },
    status: 'success'
  })
}

const profileVote = (postId: number) =>
  queryClient
    .getQueryData<Response<{ data: Topic[] }>>(['user-content', 7, 'topics', 1])
    ?.data.data.find(topic => topic.ID === postId)?.vote

const storeVote = (postId: number) =>
  usePostsStore.getState().posts.find(post => post.ID === postId)?.vote

describe('usePostsStore.toggleVote', () => {
  beforeEach(() => {
    vi.mocked(toggleVoteApi).mockReset()
    queryClient.clear()
    usePostsStore.setState({ error: undefined, isVoting: false, posts: [] })
  })

  it('moves the count on the click rather than on the response', async () => {
    usePostsStore.setState({ posts: [makeTopic(11, 3)] })
    const settle = pendingVote()

    const voting = usePostsStore.getState().toggleVote(11)

    expect(storeVote(11)).toEqual({ hasVoted: true, total: 4 })

    settle({ hasVoted: true, votes: 9 })
    await voting

    // Whatever the server counted wins over the guess.
    expect(storeVote(11)).toEqual({ hasVoted: true, total: 9 })
  })

  it('takes the vote back on the click when it was already theirs', () => {
    usePostsStore.setState({ posts: [makeTopic(11, 3, true)] })
    pendingVote()

    void usePostsStore.getState().toggleVote(11)

    expect(storeVote(11)).toEqual({ hasVoted: false, total: 2 })
  })

  it('flips a topic this store never loaded, as on a member profile', async () => {
    seedProfilePage([makeTopic(11, 3)])
    const settle = pendingVote()

    const voting = usePostsStore.getState().toggleVote(11)

    expect(profileVote(11)).toEqual({ hasVoted: true, total: 4 })

    settle({ hasVoted: true, votes: 9 })
    await voting

    expect(profileVote(11)).toEqual({ hasVoted: true, total: 9 })
  })

  it('puts the count back when the vote is refused', async () => {
    usePostsStore.setState({ posts: [makeTopic(11, 3)] })
    seedProfilePage([makeTopic(11, 3)])
    vi.mocked(toggleVoteApi).mockRejectedValue(new Error('Network down'))

    await expect(usePostsStore.getState().toggleVote(11)).rejects.toThrow('Network down')

    expect(storeVote(11)).toEqual({ hasVoted: false, total: 3 })
    expect(profileVote(11)).toEqual({ hasVoted: false, total: 3 })
  })

  it('leaves other topics alone', async () => {
    usePostsStore.setState({ posts: [makeTopic(11, 3), makeTopic(12, 8)] })
    vi.mocked(toggleVoteApi).mockResolvedValue({ hasVoted: true, votes: 4 })

    await usePostsStore.getState().toggleVote(11)

    expect(storeVote(12)).toEqual({ hasVoted: false, total: 8 })
  })
})
