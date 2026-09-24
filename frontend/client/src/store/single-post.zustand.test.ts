import { type Topic } from '@features/topic-modal/shared/type'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { type TopicComment } from '@/types/wordpress-post'

import { toggleVoteApi } from './data/toggle-vote-api'
import { sortHierarchicalComments, transformTopicCommentsToComments } from './helper/post-commons'
import { useSinglePostStore } from './single-post.zustand'

vi.mock('./data/toggle-vote-api', () => ({ toggleVoteApi: vi.fn() }))

const makePost = (id: number, total: number, hasVoted = false): Topic =>
  ({
    ID: id,
    post_author: '7',
    post_title: `Topic ${id}`,
    vote: { hasVoted, total }
  }) as Topic

const makeComment = (id: number, total: number, hasVoted = false): TopicComment =>
  ({
    comment_content: 'nice',
    comment_date_gmt: '2026-01-01 00:00:00',
    comment_ID: String(id),
    comment_parent: '0',
    comment_post_ID: '11',
    user_id: '7',
    vote: { hasVoted, total }
  }) as TopicComment

/** A request that has been sent but has not come back yet. */
const pending = <T>(api: { mockReturnValue: (value: Promise<T>) => unknown }) => {
  let settle!: (value: T) => void
  const promise = new Promise<T>(resolve => {
    settle = resolve
  })

  api.mockReturnValue(promise)

  return settle
}

/** Seed the raw comments and the tree the buttons actually render from. */
const seedComments = (comments: TopicComment[]) => {
  useSinglePostStore.setState({
    comments,
    transformedComments: sortHierarchicalComments(transformTopicCommentsToComments(comments), 'newest')
  })
}

const postVote = () => useSinglePostStore.getState().post?.vote

const commentVote = (id: number) =>
  useSinglePostStore.getState().transformedComments.find(comment => comment.id === id)?.votes

describe('useSinglePostStore vote buttons', () => {
  beforeEach(() => {
    vi.mocked(toggleVoteApi).mockReset()
    useSinglePostStore.setState({
      comments: [],
      error: undefined,
      isVoting: false,
      post: undefined,
      transformedComments: []
    })
  })

  it('moves the topic count on the click rather than on the response', async () => {
    useSinglePostStore.setState({ post: makePost(11, 3) })
    const settle = pending(vi.mocked(toggleVoteApi))

    const voting = useSinglePostStore.getState().toggleVote(11)

    expect(postVote()).toEqual({ hasVoted: true, total: 4 })

    settle({ hasVoted: true, votes: 9 })
    await voting

    expect(postVote()).toEqual({ hasVoted: true, total: 9 })
  })

  it('puts the topic count back when the vote is refused', async () => {
    useSinglePostStore.setState({ post: makePost(11, 3) })
    vi.mocked(toggleVoteApi).mockRejectedValue(new Error('Network down'))

    await expect(useSinglePostStore.getState().toggleVote(11)).rejects.toThrow('Network down')

    expect(postVote()).toEqual({ hasVoted: false, total: 3 })
  })

  it('leaves the topic on screen alone when the vote was for another one', async () => {
    useSinglePostStore.setState({ post: makePost(11, 3) })
    vi.mocked(toggleVoteApi).mockResolvedValue({ hasVoted: true, votes: 1 })

    await useSinglePostStore.getState().toggleVote(12)

    expect(postVote()).toEqual({ hasVoted: false, total: 3 })
  })

  /**
   * The store no longer casts a reply's vote, it only shows one.
   *
   * This plugin does not implement upvoting a reply; whatever does owns the
   * request and the optimistic step and writes the result here. What is left
   * is a setter, so what is worth pinning is that it reaches both copies of
   * the thread: the raw comments and the derived tree the button reads from.
   */
  it('writes a reply vote into both the raw comments and the rendered tree', () => {
    seedComments([makeComment(90, 2)])

    useSinglePostStore.getState().setCommentVote(90, { hasVoted: true, total: 7 })

    expect(commentVote(90)).toBe(7)
  })
})
