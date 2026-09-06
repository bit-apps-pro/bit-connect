import { renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import get from '@/utils/request/get'
import post from '@/utils/request/post'

import { createQueryWrapper } from '../../../../config/test-query-wrapper'
import {
  NOTIFICATIONS_KEY,
  UNREAD_KEY,
  unreadEnvelope,
  useInfiniteNotifications,
  useMarkNotificationsRead,
  useNotifications,
  useUnreadCount
} from './use-notifications'

vi.mock('@/utils/request/get', () => ({ default: vi.fn() }))
vi.mock('@/utils/request/post', () => ({ default: vi.fn() }))

vi.mock('@/config/config', () => ({
  default: { IS_LOGGED_IN: true, UNREAD_NOTIFICATIONS: 4 }
}))

const feed = (page: number, totalPages: number, unread = 0) => ({
  data: {
    data: [{ id: page, type: 'topic_reply' }],
    pagination: { current_page: page, per_page: 20, total: totalPages * 20, total_pages: totalPages },
    unread
  }
})

beforeEach(() => {
  vi.clearAllMocks()
})

describe('the number on the bell', () => {
  // Seeded from the server-rendered config so the badge is correct on first
  // paint rather than popping in a beat after the header draws.
  it('is right on the first paint, before any request has been made', () => {
    vi.mocked(get).mockReturnValue(
      new Promise(() => {
        /* never settles */
      })
    )
    const { wrapper } = createQueryWrapper()

    const { result } = renderHook(() => useUnreadCount(), { wrapper })

    expect(result.current.unreadCount).toBe(4)
  })

  it('takes the server’s number once the poll answers', async () => {
    vi.mocked(get).mockResolvedValue({ data: { unread: 9 } } as never)
    const { wrapper } = createQueryWrapper()

    const { result } = renderHook(() => useUnreadCount(), { wrapper })

    await waitFor(() => expect(result.current.unreadCount).toBe(9))
  })

  // A response the shape of which the client did not expect must read as zero
  // rather than as NaN on the badge.
  it('reads an unexpected answer as none rather than as nonsense', async () => {
    vi.mocked(get).mockResolvedValue({ data: {} } as never)
    const { wrapper } = createQueryWrapper()

    const { result } = renderHook(() => useUnreadCount(), { wrapper })

    await waitFor(() => expect(result.current.unreadCount).toBe(0))
  })

  it('wears the same envelope the cache holds', () => {
    expect(unreadEnvelope(3)).toEqual({ data: { unread: 3 } })
  })
})

describe('the bell’s panel', () => {
  it('asks for the first page at the panel’s size', async () => {
    vi.mocked(get).mockResolvedValue(feed(1, 1) as never)
    const { wrapper } = createQueryWrapper()

    renderHook(() => useNotifications({}), { wrapper })

    await waitFor(() =>
      expect(get).toHaveBeenCalledWith(
        'notifications',
        expect.objectContaining({ queryParam: expect.objectContaining({ page: 1, per_page: 10 }) })
      )
    )
  })

  it('asks only for unread rows when the filter is on', async () => {
    vi.mocked(get).mockResolvedValue(feed(1, 1) as never)
    const { wrapper } = createQueryWrapper()

    renderHook(() => useNotifications({ unread: true }), { wrapper })

    await waitFor(() =>
      expect(get).toHaveBeenCalledWith(
        'notifications',
        expect.objectContaining({ queryParam: expect.objectContaining({ unread: 1 }) })
      )
    )
  })

  // The flag it carries would otherwise be sent as `unread=0`, which the server
  // reads as a filter rather than as its absence.
  it('leaves the filter out entirely when it is off', async () => {
    vi.mocked(get).mockResolvedValue(feed(1, 1) as never)
    const { wrapper } = createQueryWrapper()

    renderHook(() => useNotifications({ unread: false }), { wrapper })

    await waitFor(() => expect(get).toHaveBeenCalled())

    expect(vi.mocked(get).mock.calls[0][1]).toMatchObject({
      queryParam: expect.not.objectContaining({ unread: expect.anything() })
    })
  })

  it('unwraps the feed out of the envelope', async () => {
    vi.mocked(get).mockResolvedValue(feed(1, 1, 2) as never)
    const { wrapper } = createQueryWrapper()

    const { result } = renderHook(() => useNotifications({}), { wrapper })

    await waitFor(() => expect(result.current.notifications?.unread).toBe(2))
  })

  it('reports a failure rather than an empty feed', async () => {
    vi.mocked(get).mockRejectedValue(new Error('Network down'))
    const { wrapper } = createQueryWrapper()

    const { result } = renderHook(() => useNotifications({}), { wrapper })

    await waitFor(() => expect(result.current.isNotificationsError).toBe(true))
  })

  it('does not ask at all when told not to', () => {
    const { wrapper } = createQueryWrapper()

    renderHook(() => useNotifications({}, false), { wrapper })

    expect(get).not.toHaveBeenCalled()
  })
})

describe('the full list', () => {
  it('loads the next page when the reader reaches the bottom', async () => {
    vi.mocked(get)
      .mockResolvedValueOnce(feed(1, 2) as never)
      .mockResolvedValueOnce(feed(2, 2) as never)

    const { wrapper } = createQueryWrapper()
    const { result } = renderHook(() => useInfiniteNotifications(false), { wrapper })

    await waitFor(() => expect(result.current.hasMore).toBe(true))

    await result.current.loadMore()

    await waitFor(() => expect(result.current.notifications).toHaveLength(2))
  })

  // undefined is TanStack's "there is no next page", which is what stops the
  // sentinel asking again at the end of the list.
  it('stops asking once the last page has arrived', async () => {
    vi.mocked(get).mockResolvedValue(feed(1, 1) as never)
    const { wrapper } = createQueryWrapper()

    const { result } = renderHook(() => useInfiniteNotifications(false), { wrapper })

    await waitFor(() => expect(result.current.isNotificationsLoading).toBe(false))

    expect(result.current.hasMore).toBe(false)
  })

  // Swapping the loaded list for a skeleton while a later page arrives would
  // throw the reader back to the top.
  it('only reports loading for the first page', async () => {
    vi.mocked(get).mockResolvedValue(feed(1, 3) as never)
    const { wrapper } = createQueryWrapper()

    const { result } = renderHook(() => useInfiniteNotifications(false), { wrapper })

    expect(result.current.isNotificationsLoading).toBe(true)

    await waitFor(() => expect(result.current.isNotificationsLoading).toBe(false))
  })

  it('reports the total off the page it has', async () => {
    vi.mocked(get).mockResolvedValue(feed(1, 3) as never)
    const { wrapper } = createQueryWrapper()

    const { result } = renderHook(() => useInfiniteNotifications(false), { wrapper })

    await waitFor(() => expect(result.current.total).toBe(60))
  })

  it('asks for unread rows only when the tab is on unread', async () => {
    vi.mocked(get).mockResolvedValue(feed(1, 1) as never)
    const { wrapper } = createQueryWrapper()

    renderHook(() => useInfiniteNotifications(true), { wrapper })

    await waitFor(() =>
      expect(get).toHaveBeenCalledWith(
        'notifications',
        expect.objectContaining({ queryParam: expect.objectContaining({ unread: 1 }) })
      )
    )
  })
})

describe('marking notifications read', () => {
  // Clearing the bell *is* the receipt for the click, and a receipt that
  // arrives a round trip later reads as nothing having happened.
  it('drops the badge to zero the moment "mark all" is confirmed', async () => {
    vi.mocked(post).mockResolvedValue({ data: { read: 4 } } as never)
    const { queryClient, wrapper } = createQueryWrapper()

    queryClient.setQueryData([UNREAD_KEY], unreadEnvelope(4))

    const { result } = renderHook(() => useMarkNotificationsRead(), { wrapper })

    await result.current.markRead({ all: true })

    expect(queryClient.getQueryData([UNREAD_KEY])).toEqual(unreadEnvelope(0))
  })

  it('takes exactly as many off the badge as were marked', async () => {
    vi.mocked(post).mockResolvedValue({ data: { read: 2 } } as never)
    const { queryClient, wrapper } = createQueryWrapper()

    queryClient.setQueryData([UNREAD_KEY], unreadEnvelope(5))

    const { result } = renderHook(() => useMarkNotificationsRead(), { wrapper })

    await result.current.markRead({ ids: [1, 2] })

    expect(queryClient.getQueryData([UNREAD_KEY])).toEqual(unreadEnvelope(3))
  })

  // A number decremented locally is a guess until the server agrees, and the
  // guess must never go below nothing.
  it('never takes the badge below zero', async () => {
    vi.mocked(post).mockResolvedValue({ data: { read: 3 } } as never)
    const { queryClient, wrapper } = createQueryWrapper()

    queryClient.setQueryData([UNREAD_KEY], unreadEnvelope(1))

    const { result } = renderHook(() => useMarkNotificationsRead(), { wrapper })

    await result.current.markRead({ ids: [1, 2, 3] })

    expect(queryClient.getQueryData([UNREAD_KEY])).toEqual(unreadEnvelope(0))
  })

  it('sends what it was asked to mark', async () => {
    vi.mocked(post).mockResolvedValue({ data: { read: 1 } } as never)
    const { wrapper } = createQueryWrapper()

    const { result } = renderHook(() => useMarkNotificationsRead(), { wrapper })

    await result.current.markRead({ ids: [7] })

    expect(post).toHaveBeenCalledWith('notifications/read', { body: { ids: [7] } })
  })

  // The badge is a guess until the server agrees, so the list and the count are
  // both asked again.
  it('refetches the list and the count afterwards', async () => {
    vi.mocked(post).mockResolvedValue({ data: { read: 1 } } as never)
    const { queryClient, wrapper } = createQueryWrapper()
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries')

    const { result } = renderHook(() => useMarkNotificationsRead(), { wrapper })

    await result.current.markRead({ all: true })

    expect(invalidate).toHaveBeenCalledWith({ queryKey: [NOTIFICATIONS_KEY] })
    expect(invalidate).toHaveBeenCalledWith({ queryKey: [UNREAD_KEY] })
  })

  // Nothing is taken off the badge for a request that failed.
  it('leaves the badge alone when the request is refused', async () => {
    vi.mocked(post).mockRejectedValue(new Error('Not allowed.'))
    const { queryClient, wrapper } = createQueryWrapper()

    queryClient.setQueryData([UNREAD_KEY], unreadEnvelope(5))

    const { result } = renderHook(() => useMarkNotificationsRead(), { wrapper })

    await expect(result.current.markRead({ all: true })).rejects.toThrow('Not allowed.')

    expect(queryClient.getQueryData([UNREAD_KEY])).toEqual(unreadEnvelope(5))
  })
})
