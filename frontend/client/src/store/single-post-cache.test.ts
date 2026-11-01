import { type Topic } from '@features/topic-modal/shared/type'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { queryClient } from '@/config/query-client'
import { type TopicComment } from '@/types/wordpress-post'

import type * as FetchPostApi from './data/fetch-post-api'

import { TOPIC_LIST_QUERY_KEY } from './data/fetch-all-posts-api'
import { fetchCommentsApi } from './data/fetch-comments-api'
import { fetchPostByNameApi, TopicNotFoundError } from './data/fetch-post-api'
import { useSinglePostStore } from './single-post.zustand'

vi.mock('./data/fetch-post-api', async importOriginal => ({
  ...(await importOriginal<typeof FetchPostApi>()),
  fetchPostByNameApi: vi.fn()
}))
vi.mock('./data/fetch-comments-api', () => ({ fetchCommentsApi: vi.fn() }))

const makeTopic = (id: number, slug: string, title = `Topic ${id}`): Topic =>
  ({ ID: id, post_author: '7', post_name: slug, post_title: title, vote: { hasVoted: false, total: 0 } }) as Topic

const makeComment = (id: number, topicId: number): TopicComment =>
  ({
    comment_content: 'nice',
    comment_date_gmt: '2026-01-01 00:00:00',
    comment_ID: String(id),
    comment_parent: '0',
    comment_post_ID: String(topicId),
    user_id: '7',
    vote: { hasVoted: false, total: 0 }
  }) as TopicComment

const onePage = (comments: TopicComment[]) => ({
  comments,
  pagination: { current_page: 1, per_page: 10, total: comments.length, total_pages: 1 }
})

/** A cached list page holding these topics, as the portal listing leaves it. */
const cacheList = (topics: Topic[]) =>
  queryClient.setQueryData([...TOPIC_LIST_QUERY_KEY, {}, 1, 10], {
    pageParams: [1],
    pages: [{ pagination: { current_page: 1, per_page: 10, total: topics.length, total_pages: 1 }, topics }]
  })

const state = () => useSinglePostStore.getState()

describe('useSinglePostStore topic cache', () => {
  beforeEach(() => {
    queryClient.clear()
    vi.mocked(fetchPostByNameApi).mockReset()
    vi.mocked(fetchCommentsApi).mockReset()
    useSinglePostStore.setState({ comments: [], error: undefined, post: undefined, transformedComments: [] })
  })

  it('shows the card from the list before the topic request comes back', async () => {
    const card = makeTopic(5, 'hello', 'From the list')
    cacheList([card])

    let settle!: (topic: Topic) => void
    vi.mocked(fetchPostByNameApi).mockReturnValue(new Promise(resolve => (settle = resolve)))
    vi.mocked(fetchCommentsApi).mockResolvedValue(onePage([makeComment(1, 5)]))

    const load = state().fetchPostByName('hello')

    expect(state().post?.post_title).toBe('From the list')
    expect(state().isLoading).toBe(false)
    // The topic ID is known, so the comments did not wait for the topic.
    expect(fetchCommentsApi).toHaveBeenCalledWith(5, expect.objectContaining({ page: 1 }))

    settle(makeTopic(5, 'hello', 'From the server'))
    await load

    expect(state().post?.post_title).toBe('From the server')
    expect(state().comments).toHaveLength(1)
  })

  it('sends one topic request when the page asks twice at once', async () => {
    vi.mocked(fetchPostByNameApi).mockResolvedValue(makeTopic(5, 'hello'))
    vi.mocked(fetchCommentsApi).mockResolvedValue(onePage([]))

    await Promise.all([state().fetchPostByName('hello'), state().fetchPostByName('hello')])

    expect(fetchPostByNameApi).toHaveBeenCalledTimes(1)
    expect(fetchCommentsApi).toHaveBeenCalledTimes(1)
  })

  it('opens a topic seen a moment ago with no request at all', async () => {
    vi.mocked(fetchPostByNameApi).mockResolvedValue(makeTopic(5, 'hello'))
    vi.mocked(fetchCommentsApi).mockResolvedValue(onePage([makeComment(1, 5)]))
    await state().fetchPostByName('hello')

    useSinglePostStore.setState({ comments: [], post: undefined, transformedComments: [] })
    await state().fetchPostByName('hello')

    expect(fetchPostByNameApi).toHaveBeenCalledTimes(1)
    expect(fetchCommentsApi).toHaveBeenCalledTimes(1)
    expect(state().post?.ID).toBe(5)
    expect(state().transformedComments).toHaveLength(1)
  })

  it('keeps a vote made on the page for the next visit', async () => {
    vi.mocked(fetchPostByNameApi).mockResolvedValue(makeTopic(5, 'hello'))
    vi.mocked(fetchCommentsApi).mockResolvedValue(onePage([]))
    await state().fetchPostByName('hello')

    const post = state().post as Topic
    state().setPost({ ...post, vote: { hasVoted: true, total: 1 } })
    useSinglePostStore.setState({ post: undefined })
    await state().fetchPostByName('hello')

    expect(state().post?.vote).toEqual({ hasVoted: true, total: 1 })
  })

  it('takes a topic that is gone off the screen, though the list still had it', async () => {
    cacheList([makeTopic(5, 'hello')])
    vi.mocked(fetchPostByNameApi).mockRejectedValue(new TopicNotFoundError())
    vi.mocked(fetchCommentsApi).mockResolvedValue(onePage([]))

    await expect(state().fetchPostByName('hello')).rejects.toBeInstanceOf(TopicNotFoundError)

    expect(state().post).toBeUndefined()
    expect(state().error).toBeTruthy()
  })
})
