import { type Response } from '@common/helpers/request'
import { queryClient } from '@config/query-client'
import { type Topic } from '@features/topic-modal/shared/type'
import { beforeEach, describe, expect, it } from 'vitest'

import { type FeedEntry, type UserComment } from '@/pages/User/data/use-user-content'

import { syncTopicVote } from './topic-vote-sync'

const makeTopic = (id: number, votes: number, author = '7'): Topic =>
  ({
    ID: id,
    post_author: author,
    post_name: `topic-${id}`,
    post_title: `Topic ${id}`,
    vote: { hasVoted: false, total: votes }
  }) as Topic

const makeComment = (id: number): UserComment => ({
  comment_content: 'nice',
  comment_date_gmt: '2026-01-01 00:00:00',
  comment_ID: id,
  comment_post_ID: 500,
  post_name: 'topic-500',
  post_title: 'Topic 500',
  vote: { hasVoted: false, total: 2 }
})

const envelope = <T>(data: T): Response<T> => ({ code: 'SUCCESS', data, status: 'success' })

const seed = (tab: string, items: (FeedEntry | Topic | UserComment)[], page = 1) => {
  queryClient.setQueryData(
    ['user-content', 7, tab, page],
    envelope({
      data: items,
      pagination: { current_page: page, per_page: 10, total: items.length, total_pages: 1 }
    })
  )
}

const read = (tab: string, page = 1) =>
  queryClient.getQueryData<Response<{ data: (FeedEntry | Topic | UserComment)[] }>>([
    'user-content',
    7,
    tab,
    page
  ])?.data.data

describe('syncTopicVote', () => {
  beforeEach(() => {
    queryClient.clear()
  })

  it('moves the vote on a topic listed bare, as the topics and upvoted tabs list it', () => {
    seed('topics', [makeTopic(11, 3), makeTopic(12, 8)])

    syncTopicVote(11, { hasVoted: true, total: 4 })

    const items = read('topics') as Topic[]
    expect(items[0].vote).toEqual({ hasVoted: true, total: 4 })
    expect(items[1].vote).toEqual({ hasVoted: false, total: 8 })
  })

  it('moves the vote on a topic wrapped in an overview feed entry', () => {
    seed('overview', [
      { kind: 'topic', occurred_at: '2026-01-01 00:00:00', topic: makeTopic(11, 3) },
      { comment: makeComment(90), kind: 'comment', occurred_at: '2026-01-02 00:00:00' }
    ])

    syncTopicVote(11, { hasVoted: true, total: 4 })

    const items = read('overview') as FeedEntry[]
    expect(items[0].kind === 'topic' && items[0].topic.vote).toEqual({ hasVoted: true, total: 4 })
    expect(items[1].kind).toBe('comment')
  })

  it('reaches every cached tab and page holding the topic', () => {
    seed('topics', [makeTopic(11, 3)])
    seed('votes', [makeTopic(11, 3)], 2)

    syncTopicVote(11, { hasVoted: true, total: 4 })

    expect((read('topics') as Topic[])[0].vote.total).toBe(4)
    expect((read('votes', 2) as Topic[])[0].vote.total).toBe(4)
  })

  it('returns the author id so the caller can move their upvote total', () => {
    seed('topics', [makeTopic(11, 3, '42')])

    expect(syncTopicVote(11, { hasVoted: true, total: 4 })).toBe('42')
  })

  it('returns nothing when no cached page holds the topic', () => {
    seed('topics', [makeTopic(12, 8)])

    expect(syncTopicVote(11, { hasVoted: true, total: 4 })).toBeUndefined()
  })

  it('leaves an untouched page at the same reference, so it does not re-render', () => {
    seed('comments', [makeComment(90)])
    const before = read('comments')

    syncTopicVote(11, { hasVoted: true, total: 4 })

    expect(read('comments')).toBe(before)
  })

  it('does nothing when nothing is cached yet', () => {
    expect(() => syncTopicVote(11, { hasVoted: true, total: 4 })).not.toThrow()
  })
})
