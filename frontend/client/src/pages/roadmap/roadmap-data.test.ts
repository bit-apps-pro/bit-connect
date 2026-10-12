import { type Topic } from '@features/topic-modal/shared/type'
import { describe, expect, it } from 'vitest'

import { type TopicsPage } from '@/store/data/fetch-all-posts-api'

import { COLUMN_SIZE, mergeTopics, MORE_SIZE, nextPageParam, placeNames, shortDate, withVote } from './roadmap-data'

const topic = (id: number, votes = 0, extra: Partial<Topic> = {}) =>
  ({ ID: id, terms: {}, vote: { hasVoted: false, total: votes }, ...extra }) as unknown as Topic

const page = (topics: Topic[], total: number): TopicsPage => ({
  pagination: { current_page: 1, per_page: topics.length, total, total_pages: 1 },
  topics
})

describe('nextPageParam', () => {
  it('asks for cards 21–30 after the first page of 20', () => {
    expect(nextPageParam(page([], 51), [page([], 51)])).toEqual({ page: 3, perPage: MORE_SIZE })
  })

  it('keeps counting in tens after that', () => {
    const pages = [page([], 51), page([], 51), page([], 51)]

    expect(nextPageParam(page([], 51), pages)).toEqual({ page: 5, perPage: MORE_SIZE })
  })

  it('stops once every card is loaded', () => {
    expect(nextPageParam(page([], COLUMN_SIZE), [page([], COLUMN_SIZE)])).toBeUndefined()
    expect(nextPageParam(page([], 30), [page([], 30), page([], 30)])).toBeUndefined()
  })

  it('needs the first page to be whole pages of the next', () => {
    expect(COLUMN_SIZE % MORE_SIZE).toBe(0)
  })
})

describe('mergeTopics', () => {
  it('orders by votes, keeping the server order among equals', () => {
    const merged = mergeTopics([page([topic(1, 2), topic(2, 0), topic(3, 2), topic(4, 5)], 4)])

    expect(merged.map(item => item.ID)).toEqual([4, 1, 3, 2])
  })

  it('lists a card once when it shifted across a page boundary', () => {
    const merged = mergeTopics([page([topic(1, 3), topic(2, 1)], 3), page([topic(2, 1), topic(3, 0)], 3)])

    expect(merged.map(item => item.ID)).toEqual([1, 2, 3])
  })
})

describe('withVote', () => {
  it('replaces the vote wherever the topic was loaded, and nothing else', () => {
    const data = { pageParams: [], pages: [page([topic(1), topic(2)], 3), page([topic(3)], 3)] }
    const next = withVote(data, 3, { hasVoted: true, total: 1 })

    expect(next?.pages[1].topics[0].vote).toEqual({ hasVoted: true, total: 1 })
    expect(next?.pages[0].topics[0]).toBe(data.pages[0].topics[0])
  })

  it('leaves an empty cache empty', () => {
    expect(withVote(undefined, 1, { hasVoted: true, total: 1 })).toBeUndefined()
  })
})

describe('shortDate', () => {
  const now = new Date('2026-10-12T12:00:00Z')

  it('reads the server’s GMT time and names month and day', () => {
    expect(shortDate('2026-09-28 10:00:00', { lang: 'en-US', now })).toBe('Sep 28')
  })

  it('adds the year outside the current one', () => {
    expect(shortDate('2025-03-04 10:00:00', { lang: 'en-US', now })).toBe('Mar 4, 2025')
  })

  it('answers nothing for a date it cannot read', () => {
    expect(shortDate('not a date', { lang: 'en-US', now })).toBe('')
  })
})

describe('placeNames', () => {
  const boards = { filter: 'boards', follow: 'board', label: 'Board', taxonomy: 'acme-boards' }

  it('names the topic’s term in each added archive', () => {
    const filed = topic(1, 0, { terms: { boards: { name: 'Plugin developers' } } as unknown as Topic['terms'] })

    expect(placeNames(filed, [boards])).toEqual([{ label: 'Board', name: 'Plugin developers' }])
  })

  it('names nothing for a topic filed under none', () => {
    expect(placeNames(topic(1), [boards])).toEqual([])
  })
})
