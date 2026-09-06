import { request } from '@common/request'
import { renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { createQueryWrapper } from '../../../config/test-query-wrapper'
import { useReports, useResolveReport } from './use-reports'

vi.mock('@common/request', () => ({ request: vi.fn() }))

const entry = (targetId: number, targetType = 'post') => ({
  count: 2,
  details: [],
  excerpt: '',
  exists: true,
  first_at: '2026-08-27 09:00:00',
  latest_at: '2026-08-27 10:00:00',
  link: '',
  reason_labels: {},
  reasons: { spam: 2 },
  reporters: [],
  target_author: 7,
  target_author_name: 'Rahim',
  target_id: targetId,
  target_type: targetType,
  title: `Topic ${targetId}`
})

const queue = (entries: ReturnType<typeof entry>[], total = entries.length) => ({
  code: 'SUCCESS',
  data: {
    data: entries,
    pagination: { current_page: 1, per_page: 10, total, total_pages: 1 },
    truncated: false
  },
  status: 'success'
})

beforeEach(() => {
  vi.clearAllMocks()
})

describe('reading the queue', () => {
  it('sends the filters the screen is showing', async () => {
    vi.mocked(request).mockResolvedValue(queue([]) as never)
    const { wrapper } = createQueryWrapper()

    renderHook(() => useReports({ page: 2, status: 'pending' }), { wrapper })

    await waitFor(() =>
      expect(request).toHaveBeenCalledWith(
        'reports',
        expect.objectContaining({ method: 'GET', queryParam: { page: 2, status: 'pending' } })
      )
    )
  })

  it('unwraps the queue out of the envelope', async () => {
    vi.mocked(request).mockResolvedValue(queue([entry(1)]) as never)
    const { wrapper } = createQueryWrapper()

    const { result } = renderHook(() => useReports({}), { wrapper })

    await waitFor(() => expect(result.current.reports?.data).toHaveLength(1))
  })

  it('reports a failure rather than an empty queue', async () => {
    vi.mocked(request).mockRejectedValue(new Error('Network down'))
    const { wrapper } = createQueryWrapper()

    const { result } = renderHook(() => useReports({}), { wrapper })

    await waitFor(() => expect(result.current.isReportsError).toBe(true))
  })

  // Dimming the list for the refetch that follows a decision would grey out the
  // very card the moderator is watching leave.
  it('is only stale while a different page is loading behind this one', async () => {
    vi.mocked(request).mockResolvedValue(queue([entry(1)]) as never)
    const { wrapper } = createQueryWrapper()

    const { result } = renderHook(() => useReports({ page: 1 }), { wrapper })

    await waitFor(() => expect(result.current.isReportsFetching).toBe(false))

    expect(result.current.isReportsStale).toBe(false)
  })
})

describe('resolving a report', () => {
  // The card's exit animation is the receipt for the decision; a receipt that
  // arrives after a network wait reads as the button having done nothing.
  it('takes the card out of the cache the moment the server confirms', async () => {
    vi.mocked(request).mockResolvedValue({ data: { closed: 2 } } as never)
    const { queryClient, wrapper } = createQueryWrapper()

    queryClient.setQueryData(['reports', { status: 'pending' }], queue([entry(1), entry(2)]))

    const { result } = renderHook(() => useResolveReport(), { wrapper })

    await result.current.resolve({ status: 'resolved_kept', target_id: 1, target_type: 'post' })

    const cached = queryClient.getQueryData(['reports', { status: 'pending' }]) as ReturnType<
      typeof queue
    >

    expect(cached.data.data.map(one => one.target_id)).toEqual([2])
  })

  it('takes one off the total along with the card', async () => {
    vi.mocked(request).mockResolvedValue({ data: { closed: 1 } } as never)
    const { queryClient, wrapper } = createQueryWrapper()

    queryClient.setQueryData(['reports', { status: 'pending' }], queue([entry(1)], 30))

    const { result } = renderHook(() => useResolveReport(), { wrapper })

    await result.current.resolve({ status: 'resolved_kept', target_id: 1, target_type: 'post' })

    const cached = queryClient.getQueryData(['reports', { status: 'pending' }]) as ReturnType<
      typeof queue
    >

    expect(cached.data.pagination.total).toBe(29)
  })

  // The tab the item is moving *to* has no row to remove, so its total is left
  // alone rather than quietly losing one.
  it('leaves a page that never held the card completely untouched', async () => {
    vi.mocked(request).mockResolvedValue({ data: { closed: 1 } } as never)
    const { queryClient, wrapper } = createQueryWrapper()

    const otherTab = queue([entry(2)], 5)
    queryClient.setQueryData(['reports', { status: 'resolved_kept' }], otherTab)

    const { result } = renderHook(() => useResolveReport(), { wrapper })

    await result.current.resolve({ status: 'resolved_kept', target_id: 1, target_type: 'post' })

    expect(queryClient.getQueryData(['reports', { status: 'resolved_kept' }])).toEqual(otherTab)
  })

  // A comment and a topic can share an id, and resolving one must not remove
  // the other from the queue.
  it('matches on the kind of thing as well as its id', async () => {
    vi.mocked(request).mockResolvedValue({ data: { closed: 1 } } as never)
    const { queryClient, wrapper } = createQueryWrapper()

    queryClient.setQueryData(
      ['reports', { status: 'pending' }],
      queue([entry(1, 'post'), entry(1, 'comment')])
    )

    const { result } = renderHook(() => useResolveReport(), { wrapper })

    await result.current.resolve({ status: 'resolved_kept', target_id: 1, target_type: 'comment' })

    const cached = queryClient.getQueryData(['reports', { status: 'pending' }]) as ReturnType<
      typeof queue
    >

    expect(cached.data.data.map(one => one.target_type)).toEqual(['post'])
  })

  it('clears every cached page at once', async () => {
    vi.mocked(request).mockResolvedValue({ data: { closed: 1 } } as never)
    const { queryClient, wrapper } = createQueryWrapper()

    queryClient.setQueryData(['reports', { page: 1 }], queue([entry(1)]))
    queryClient.setQueryData(['reports', { page: 2 }], queue([entry(1)]))

    const { result } = renderHook(() => useResolveReport(), { wrapper })

    await result.current.resolve({ status: 'resolved_kept', target_id: 1, target_type: 'post' })

    for (const page of [1, 2]) {
      const cached = queryClient.getQueryData(['reports', { page }]) as ReturnType<typeof queue>

      expect(cached.data.data).toEqual([])
    }
  })

  // The entry has to appear on whichever tab it moved to, and the counts on
  // every other page are now off by one.
  it('still asks the server again afterwards', async () => {
    vi.mocked(request).mockResolvedValue({ data: { closed: 1 } } as never)
    const { queryClient, wrapper } = createQueryWrapper()
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries')

    const { result } = renderHook(() => useResolveReport(), { wrapper })

    await result.current.resolve({ status: 'resolved_kept', target_id: 1, target_type: 'post' })

    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['reports'] })
  })

  it('sends the decision and any note with it', async () => {
    vi.mocked(request).mockResolvedValue({ data: { closed: 1 } } as never)
    const { wrapper } = createQueryWrapper()

    const { result } = renderHook(() => useResolveReport(), { wrapper })

    await result.current.resolve({
      note: 'Removed as spam.',
      status: 'resolved_removed',
      target_id: 1,
      target_type: 'post'
    })

    expect(request).toHaveBeenCalledWith('reports/resolve', {
      body: {
        note: 'Removed as spam.',
        status: 'resolved_removed',
        target_id: 1,
        target_type: 'post'
      },
      method: 'POST'
    })
  })

  // Nothing leaves the queue for a decision the server refused.
  it('leaves the queue alone when the decision is refused', async () => {
    vi.mocked(request).mockRejectedValue(new Error('There is nothing left to review on this.'))
    const { queryClient, wrapper } = createQueryWrapper()

    const page = queue([entry(1)])
    queryClient.setQueryData(['reports', { status: 'pending' }], page)

    const { result } = renderHook(() => useResolveReport(), { wrapper })

    await expect(
      result.current.resolve({ status: 'resolved_kept', target_id: 1, target_type: 'post' })
    ).rejects.toThrow()

    expect(queryClient.getQueryData(['reports', { status: 'pending' }])).toEqual(page)
  })
})
