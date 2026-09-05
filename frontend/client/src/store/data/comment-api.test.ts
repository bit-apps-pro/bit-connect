import queryRequest from '@common/helpers/request'
import getRequest from '@utils/request/get'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { commentResponseToTopicComment, createCommentApi } from './create-comment-api'
import { fetchCommentsApi } from './fetch-comments-api'

vi.mock('@common/helpers/request', () => ({ default: vi.fn() }))
vi.mock('@utils/request/get', () => ({ default: vi.fn() }))

/** A comment as the REST API sends it. */
const serverComment = (overrides: Record<string, unknown> = {}) => ({
  author: 7,
  author_avatar_urls: { 24: '/24.png', 48: '/48.png', 96: '/96.png' },
  author_name: 'Rahim',
  author_url: 'https://example.com/u/rahim',
  content: { rendered: '<p>Same here.</p>' },
  date: '2026-08-27 09:00:00',
  date_gmt: '2026-08-27 03:00:00',
  id: 55,
  link: 'https://example.com/t/1#comment-55',
  parent: 0,
  post: 9,
  status: 'approved',
  type: 'comment',
  ...overrides
})

beforeEach(() => {
  vi.clearAllMocks()
})

describe('reading a comment off the wire', () => {
  it('maps the server’s shape onto the one the thread renders', () => {
    const comment = commentResponseToTopicComment(serverComment() as never)

    expect(comment.comment_ID).toBe('55')
    expect(comment.comment_post_ID).toBe('9')
    expect(comment.comment_parent).toBe('0')
    expect(comment.comment_author).toBe('Rahim')
    expect(comment.comment_content).toBe('<p>Same here.</p>')
  })

  // Dropping this left every comment in the thread showing an initial instead
  // of the face the same person shows everywhere else on the page. 96px is the
  // largest offered, so a 36px avatar stays sharp on a retina screen.
  it('takes the largest avatar the server offered', () => {
    expect(commentResponseToTopicComment(serverComment() as never).author_avatar).toBe('/96.png')
  })

  it('falls back through the smaller avatars, and then to nothing', () => {
    expect(
      commentResponseToTopicComment(
        serverComment({ author_avatar_urls: { 24: '/24.png', 48: '/48.png' } }) as never
      ).author_avatar
    ).toBe('/48.png')

    expect(
      commentResponseToTopicComment(serverComment({ author_avatar_urls: {} }) as never).author_avatar
    ).toBe('')
  })

  // The status arrives as a word from the REST API and as a digit from the
  // plugin's own endpoints, and the thread branches on '1'.
  it('reads approval however the server spelled it', () => {
    for (const status of ['approved', '1', 1]) {
      expect(commentResponseToTopicComment(serverComment({ status }) as never).comment_approved).toBe(
        '1'
      )
    }

    for (const status of ['hold', '0', 0, 'spam']) {
      expect(commentResponseToTopicComment(serverComment({ status }) as never).comment_approved).toBe(
        '0'
      )
    }
  })

  // The vote widget reads both fields on every row; undefined there renders as
  // an empty button rather than a zero.
  it('gives a comment nobody has voted on a vote of zero', () => {
    expect(commentResponseToTopicComment(serverComment() as never).vote).toEqual({
      hasVoted: false,
      total: 0
    })
  })

  it('carries the votes the server reported', () => {
    expect(
      commentResponseToTopicComment(serverComment({ hasVoted: true, votes: 4 }) as never).vote
    ).toEqual({ hasVoted: true, total: 4 })
  })

  it('carries an edit byline and the hidden flag through', () => {
    const comment = commentResponseToTopicComment(
      serverComment({
        edited: {
          at: '2026-08-27 10:00:00',
          by: 3,
          by_author: false,
          by_name: 'Nadia',
          by_slug: 'nadia'
        },
        hidden: true
      }) as never
    )

    expect(comment.edited?.by_name).toBe('Nadia')
    expect(comment.hidden).toBe(true)
  })

  // Null rather than an empty list: the tree builder uses it to tell "no
  // children" from "children not loaded yet".
  it('leaves the children unloaded', () => {
    const comment = commentResponseToTopicComment(serverComment() as never)

    expect(comment.children).toBeNull()
    expect(comment.populated_children).toBe(false)
  })

  it('reports no attachments as an empty list', () => {
    expect(commentResponseToTopicComment(serverComment() as never).attachments).toEqual([])
  })
})

describe('posting a comment', () => {
  it('sends just the content for a top-level reply', async () => {
    vi.mocked(queryRequest).mockResolvedValue({ data: serverComment() } as never)

    await createCommentApi('Same here.', 9)

    expect(queryRequest).toHaveBeenCalledWith('posts/9/comments', { content: 'Same here.' })
  })

  it('names the parent when replying to a reply', async () => {
    vi.mocked(queryRequest).mockResolvedValue({ data: serverComment() } as never)

    await createCommentApi('Same here.', 9, 55)

    expect(queryRequest).toHaveBeenCalledWith('posts/9/comments', {
      content: 'Same here.',
      parent_id: 55
    })
  })

  // An empty list would be sent as `attachments: []`, which the server has to
  // tell apart from "no attachments key" when deciding what to unlink.
  it('leaves the attachments out when there are none', async () => {
    vi.mocked(queryRequest).mockResolvedValue({ data: serverComment() } as never)

    await createCommentApi('Same here.', 9, undefined, [])

    expect(queryRequest).toHaveBeenCalledWith('posts/9/comments', { content: 'Same here.' })
  })

  it('sends the attachments when there are some', async () => {
    vi.mocked(queryRequest).mockResolvedValue({ data: serverComment() } as never)

    await createCommentApi('Same here.', 9, undefined, [90, 91])

    expect(queryRequest).toHaveBeenCalledWith('posts/9/comments', {
      attachments: [90, 91],
      content: 'Same here.'
    })
  })

  it('hands back the new comment in the shape the thread renders', async () => {
    vi.mocked(queryRequest).mockResolvedValue({ data: serverComment() } as never)

    await expect(createCommentApi('Same here.', 9)).resolves.toMatchObject({ comment_ID: '55' })
  })
})

/** One page of a thread, as the endpoint answers it. */
const page = (comments: unknown[], currentPage = 1) => ({
  data: {
    data: comments,
    pagination: { current_page: currentPage, per_page: 10, total: comments.length, total_pages: 1 }
  }
})

describe('loading a page of a thread', () => {
  it('asks for a page by number when nothing is being focused', async () => {
    vi.mocked(getRequest).mockResolvedValue(page([]) as never)

    await fetchCommentsApi(9, { page: 2, sort: 'mostVoted' })

    expect(getRequest).toHaveBeenCalledWith('posts/9/comments', {
      queryParam: { page: 2, per_page: 10, sort: 'mostVoted' }
    })
  })

  // Pages are reachable in sequence from the first, and which one a comment
  // falls on depends on the sort and on how many threads precede it — so the
  // page number is replaced by the comment to land on, and the server says
  // which page that was.
  it('asks for the page holding a comment rather than a page number', async () => {
    vi.mocked(getRequest).mockResolvedValue(page([], 3) as never)

    const result = await fetchCommentsApi(9, { focus: 55, page: 1 })

    expect(getRequest).toHaveBeenCalledWith('posts/9/comments', {
      queryParam: { focus: 55, per_page: 10, sort: 'newest' }
    })
    expect(result.pagination.current_page).toBe(3)
  })

  it('maps every comment on the page', async () => {
    vi.mocked(getRequest).mockResolvedValue(page([serverComment(), serverComment({ id: 56 })]) as never)

    const result = await fetchCommentsApi(9)

    expect(result.comments.map(one => one.comment_ID)).toEqual(['55', '56'])
  })

  // The list maps over `comments` and the pager reads `pagination`, so a
  // response missing either must not leave them undefined.
  it('answers a usable page even when the body is not what was expected', async () => {
    vi.mocked(getRequest).mockResolvedValue({
      data: { data: undefined, pagination: undefined }
    } as never)

    const result = await fetchCommentsApi(9)

    expect(result.comments).toEqual([])
    expect(result.pagination).toEqual({
      current_page: 1,
      per_page: 0,
      total: 0,
      total_pages: 1
    })
  })
})
