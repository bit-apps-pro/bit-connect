import { describe, expect, it } from 'vitest'

import { type Comment } from '@/types/post'
import { type TopicComment } from '@/types/wordpress-post'

import { sortHierarchicalComments, transformTopicCommentsToComments } from './post-commons'

const makeComment = (overrides: Partial<Comment> & Pick<Comment, 'id'>): Comment => ({
  avatar: '',
  content: '',
  createdAt: '2023-01-01T00:00:00Z',
  isAdmin: false,
  replies: [],
  user: 'user',
  votes: 0,
  ...overrides
})

const makeTopicComment = (overrides: Partial<TopicComment>): TopicComment => ({
  children: null,
  comment_approved: '1',
  comment_author: 'author',
  comment_author_url: '',
  comment_content: 'body',
  comment_date: '2023-01-01T00:00:00Z',
  comment_date_gmt: '2023-01-01T00:00:00Z',
  comment_ID: '1',
  comment_karma: '0',
  comment_parent: '0',
  comment_post_ID: '100',
  comment_type: 'comment',
  populated_children: false,
  post_fields: [],
  user_id: '0',
  vote: { hasVoted: false, total: 0 },
  ...overrides
})

describe('sortHierarchicalComments', () => {
  const older = makeComment({ createdAt: '2023-01-01T00:00:00Z', id: 1, votes: 2 })
  const newer = makeComment({ createdAt: '2023-06-01T00:00:00Z', id: 2, votes: 5 })
  const newest = makeComment({ createdAt: '2023-12-01T00:00:00Z', id: 3, votes: 5 })

  it('"newest" sorts by date descending', () => {
    const result = sortHierarchicalComments([older, newest, newer], 'newest')
    expect(result.map(c => c.id)).toEqual([3, 2, 1])
  })

  it('"all" sorts by date ascending (oldest first)', () => {
    const result = sortHierarchicalComments([newest, older, newer], 'all')
    expect(result.map(c => c.id)).toEqual([1, 2, 3])
  })

  it('"mostVoted" sorts by votes desc, breaking ties by newest date', () => {
    const result = sortHierarchicalComments([older, newer, newest], 'mostVoted')
    // 2 and 3 both have 5 votes -> newest (3) first; 1 has 2 votes -> last
    expect(result.map(c => c.id)).toEqual([3, 2, 1])
  })

  it('does not mutate the input array', () => {
    const input = [newest, older, newer]
    const snapshot = input.map(c => c.id)
    sortHierarchicalComments(input, 'all')
    expect(input.map(c => c.id)).toEqual(snapshot)
  })
})

describe('transformTopicCommentsToComments', () => {
  it('maps TopicComment fields onto the app Comment shape', () => {
    const [comment] = transformTopicCommentsToComments([
      makeTopicComment({
        comment_content: 'hello',
        comment_ID: '7',
        user_id: '42',
        vote: { hasVoted: true, total: 9 }
      })
    ])

    expect(comment).toMatchObject({
      content: 'hello',
      hasVoted: true,
      id: 7,
      parentId: 0,
      userId: 42,
      votes: 9
    })
  })

  it('nests replies under their parent via comment_parent', () => {
    const tree = transformTopicCommentsToComments([
      makeTopicComment({ comment_ID: '1', comment_parent: '0' }),
      makeTopicComment({ comment_ID: '2', comment_parent: '1' }),
      makeTopicComment({ comment_ID: '3', comment_parent: '2' })
    ])

    expect(tree.map(c => c.id)).toEqual([1])
    expect(tree[0].replies.map(c => c.id)).toEqual([2])
    expect(tree[0].replies[0].replies.map(c => c.id)).toEqual([3])
  })
})
