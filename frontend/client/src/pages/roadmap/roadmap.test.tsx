import { queryClient } from '@config/query-client'
import { type Topic } from '@features/topic-modal/shared/type'
import { QueryClientProvider } from '@tanstack/react-query'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import Roadmap from './roadmap'

const api = vi.hoisted(() => ({
  allow: () => true,
  fetch: vi.fn(),
  // A request that never answers: the column stays on its first load.
  never: () => new Promise<never>(vi.fn()),
  vote: vi.fn()
}))

vi.mock('@/store/data/fetch-all-posts-api', () => ({ fetchAllPostsApi: api.fetch }))
vi.mock('@/store/data/toggle-vote-api', () => ({ toggleVoteApi: api.vote }))
vi.mock('@common/hooks/useCapabilityGate', () => ({ default: () => api.allow }))
vi.mock('@/store/auth.zustand', () => ({ useAuthStore: () => ({ can: () => true, isLoggedIn: true }) }))
vi.mock('@pages/Layout/data/use-stages', () => ({
  useStagesStore: () => ({
    fetchStages: vi.fn(),
    stages: [
      { id: 1, meta: {}, name: 'Questions', slug: 'questions' },
      { id: 2, meta: {}, name: 'Planned', slug: 'planned' },
      { id: 3, meta: {}, name: 'Shipped', slug: 'shipped' }
    ]
  })
}))
vi.mock('@/store/use-taxonomies-store', () => ({
  useTaxonomiesStoreSelect: () => ({ 'bit-connect-topic-types': [{ name: 'Bug', slug: 'bug' }] })
}))

const topic = (id: number, votes = 0, extra: Partial<Topic> = {}) =>
  ({
    author_avatar: '',
    author_name: `Author ${id}`,
    comments_count: '0',
    ID: id,
    post_name: `topic-${id}`,
    post_title: `Topic ${id}`,
    terms: { topic_types: undefined },
    vote: { hasVoted: false, total: votes },
    ...extra
  }) as unknown as Topic

/** A page of `count` topics starting at `from`, out of `total` in the stage. */
const page = (from: number, count: number, total: number) => ({
  pagination: { current_page: 1, per_page: count, total, total_pages: 1 },
  topics: Array.from({ length: count }, (_, index) => topic(from + index))
})

const renderAt = (url = '/roadmap') =>
  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[url]}>
        <Roadmap />
      </MemoryRouter>
    </QueryClientProvider>
  )

const column = (name: string) => screen.getByRole('region', { name })

describe('Roadmap', () => {
  beforeEach(() => {
    api.fetch.mockReset()
    api.vote.mockReset()
  })

  afterEach(() => {
    cleanup()
    queryClient.clear()
  })

  it('leaves out the stage new topics land in', async () => {
    api.fetch.mockResolvedValue(page(1, 0, 0))
    renderAt()

    expect(screen.queryByRole('region', { name: 'Questions' })).toBeNull()
    expect(column('Planned')).toBeTruthy()
    expect(column('Shipped')).toBeTruthy()
  })

  it('holds the board’s shape with placeholder cards while a column loads', () => {
    api.fetch.mockImplementation(api.never)
    renderAt()

    expect(within(column('Planned')).getAllByTestId('roadmap-card-skeleton')).toHaveLength(3)
  })

  it('shows 20 cards, then 10 more on each "Show more"', async () => {
    api.fetch.mockImplementation(({ page: number, per_page: size, stages }) =>
      Promise.resolve(stages === 'planned' ? page((number - 1) * size + 1, Math.min(size, 25 - (number - 1) * size), 25) : page(900, 0, 0))
    )
    renderAt()

    const planned = column('Planned')
    await waitFor(() => expect(within(planned).getAllByRole('article')).toHaveLength(20))

    fireEvent.click(within(planned).getByRole('button', { name: 'Show 5 more' }))

    await waitFor(() => expect(within(planned).getAllByRole('article')).toHaveLength(25))
    expect(api.fetch).toHaveBeenCalledWith(expect.objectContaining({ page: 3, per_page: 10, stages: 'planned' }))
    expect(within(planned).queryByRole('button', { name: /Show \d+ more/ })).toBeNull()
  })

  it('says when a filter matches nothing, once, instead of an empty column per stage', async () => {
    api.fetch.mockResolvedValue(page(1, 0, 0))
    renderAt('/roadmap?topic-types=bug')

    expect(await screen.findByText('No topics match these filters')).toBeTruthy()
    expect(screen.queryByRole('region', { name: 'Planned' })).toBeNull()
    expect(screen.getByRole('link', { name: 'Clear filters' }).getAttribute('href')).toBe('/roadmap')
  })

  it('dates the cards of the last column only', async () => {
    api.fetch.mockImplementation(({ stages }) =>
      Promise.resolve({
        pagination: { current_page: 1, per_page: 1, total: 1, total_pages: 1 },
        topics: [topic(stages === 'shipped' ? 2 : 1, 0, { stage_changed_at: '2026-09-28 10:00:00' })]
      })
    )
    renderAt()

    await waitFor(() => expect(within(column('Shipped')).getByTitle(/^Shipped /)).toBeTruthy())
    expect(within(column('Planned')).queryByTitle(/^Planned /)).toBeNull()
  })

  it('counts a vote at once, then takes the server’s total', async () => {
    api.fetch.mockImplementation(({ stages }) =>
      Promise.resolve(stages === 'planned' ? { ...page(1, 1, 1), topics: [topic(1, 4)] } : page(900, 0, 0))
    )
    api.vote.mockResolvedValue({ hasVoted: true, votes: 5 })
    renderAt()

    const button = await within(column('Planned')).findByRole('button', { name: 'Upvote' })
    fireEvent.click(button)

    await waitFor(() =>
      expect(within(column('Planned')).getByRole('button', { name: 'Remove your upvote' }).textContent).toContain('5')
    )
    expect(api.vote).toHaveBeenCalledWith(1)
  })
})
