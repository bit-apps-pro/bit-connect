import getRequest from '@utils/request/get'
import postRequest from '@utils/request/post'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { fetchAllPostsApi } from './fetch-all-posts-api'
import { fetchPostByNameApi } from './fetch-post-api'
import { toggleCommentVoteApi } from './toggle-comment-vote-api'
import { toggleVoteApi } from './toggle-vote-api'

vi.mock('@utils/request/get', () => ({ default: vi.fn() }))
vi.mock('@utils/request/post', () => ({ default: vi.fn() }))

const topic = (id: number) => ({ ID: id, post_name: `topic-${id}`, post_title: `Topic ${id}` })

beforeEach(() => {
  vi.clearAllMocks()
})

describe('loading a page of topics', () => {
  it('passes the filters straight through to the endpoint', async () => {
    vi.mocked(getRequest).mockResolvedValue({
      data: { data: [], pagination: { current_page: 1, per_page: 10, total: 0, total_pages: 1 } }
    } as never)

    await fetchAllPostsApi({ page: 2, stage: 'ideas' } as never)

    expect(getRequest).toHaveBeenCalledWith('topics', {
      queryParam: { page: 2, stage: 'ideas' }
    })
  })

  it('asks for the unfiltered list when given nothing', async () => {
    vi.mocked(getRequest).mockResolvedValue({ data: { data: [], pagination: undefined } } as never)

    await fetchAllPostsApi()

    expect(getRequest).toHaveBeenCalledWith('topics', { queryParam: {} })
  })

  it('hands back the topics and the pagination', async () => {
    vi.mocked(getRequest).mockResolvedValue({
      data: {
        data: [topic(1), topic(2)],
        pagination: { current_page: 2, per_page: 10, total: 25, total_pages: 3 }
      }
    } as never)

    const page = await fetchAllPostsApi()

    expect(page.topics).toHaveLength(2)
    expect(page.pagination.total_pages).toBe(3)
  })

  // The list maps over `topics` and the pager reads `pagination`, so an older
  // server that sends neither must not leave either undefined.
  it('invents a single-page answer when the server sent no pagination', async () => {
    vi.mocked(getRequest).mockResolvedValue({
      data: { data: [topic(1), topic(2)], pagination: undefined }
    } as never)

    const page = await fetchAllPostsApi()

    expect(page.pagination).toEqual({
      current_page: 1,
      per_page: 2,
      total: 2,
      total_pages: 1
    })
  })

  it('answers an empty page rather than undefined when there are no topics', async () => {
    vi.mocked(getRequest).mockResolvedValue({
      data: { data: undefined, pagination: undefined }
    } as never)

    const page = await fetchAllPostsApi()

    expect(page.topics).toEqual([])
    expect(page.pagination.total).toBe(0)
  })
})

// The portal addresses a topic by the slug in its URL, which resolves through
// the list endpoint rather than by id.
describe('loading one topic by its slug', () => {
  it('asks for the topic under that name', async () => {
    vi.mocked(getRequest).mockResolvedValue({ data: { data: [topic(1)] } } as never)

    await fetchPostByNameApi('topic-1')

    expect(getRequest).toHaveBeenCalledWith('topics', { queryParam: { name: 'topic-1' } })
  })

  it('hands back the first match', async () => {
    vi.mocked(getRequest).mockResolvedValue({ data: { data: [topic(1), topic(2)] } } as never)

    await expect(fetchPostByNameApi('topic-1')).resolves.toMatchObject({ ID: 1 })
  })

  // The page renders this as a 404, which is the only correct answer for a slug
  // that names nothing.
  it('reports a slug that matched nothing as not found', async () => {
    for (const body of [{ data: { data: [] } }, { data: { data: undefined } }, { data: undefined }]) {
      vi.mocked(getRequest).mockResolvedValue(body as never)

      await expect(fetchPostByNameApi('gone')).rejects.toThrow('Post not found')
    }
  })
})

describe('voting', () => {
  it('toggles a topic’s vote and hands back the new count', async () => {
    vi.mocked(postRequest).mockResolvedValue({ data: { hasVoted: true, votes: 5 } } as never)

    await expect(toggleVoteApi(9)).resolves.toEqual({ hasVoted: true, votes: 5 })
    expect(postRequest).toHaveBeenCalledWith('posts/9/vote', { body: {} })
  })

  it('toggles a comment’s vote through its own endpoint', async () => {
    vi.mocked(postRequest).mockResolvedValue({ data: { hasVoted: false, votes: 0 } } as never)

    await expect(toggleCommentVoteApi(55)).resolves.toEqual({ hasVoted: false, votes: 0 })
    expect(postRequest).toHaveBeenCalledWith('comments/55/vote', { body: {} })
  })
})
