import queryRequest from '@common/helpers/request'
import { renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { createQueryWrapper } from '../../../config/test-query-wrapper'
import useUserContent, { PROFILE_PAGE_SIZE } from './use-user-content'

vi.mock('@common/helpers/request', () => ({ default: vi.fn() }))

const page = (items: unknown[], currentPage = 1) => ({
  data: {
    data: items,
    pagination: {
      current_page: currentPage,
      per_page: PROFILE_PAGE_SIZE,
      total: items.length,
      total_pages: 1
    }
  }
})

beforeEach(() => {
  vi.clearAllMocks()
})

describe('loading a profile tab', () => {
  it('asks the endpoint for that tab, a page at a time', async () => {
    vi.mocked(queryRequest).mockResolvedValue(page([]) as never)
    const { wrapper } = createQueryWrapper()

    renderHook(() => useUserContent(7, 'topics', 2), { wrapper })

    await waitFor(() =>
      expect(queryRequest).toHaveBeenCalledWith(
        'users/7/topics',
        {},
        { page: 2, per_page: PROFILE_PAGE_SIZE },
        'GET',
        expect.anything()
      )
    )
  })

  it('unwraps the rows and the pagination', async () => {
    vi.mocked(queryRequest).mockResolvedValue(page([{ ID: 1 }, { ID: 2 }]) as never)
    const { wrapper } = createQueryWrapper()

    const { result } = renderHook(() => useUserContent(7, 'topics', 1), { wrapper })

    await waitFor(() => expect(result.current.items).toHaveLength(2))
    expect(result.current.pagination.total).toBe(2)
  })

  // The list maps over `items` and the pager reads `pagination`, so neither may
  // ever be undefined — not while loading and not after a failure.
  it('has an empty list and a first page before anything arrives', () => {
    vi.mocked(queryRequest).mockReturnValue(
      new Promise(() => {
        /* never settles */
      }) as never
    )
    const { wrapper } = createQueryWrapper()

    const { result } = renderHook(() => useUserContent(7, 'topics', 1), { wrapper })

    expect(result.current.items).toEqual([])
    expect(result.current.pagination).toEqual({
      current_page: 1,
      per_page: PROFILE_PAGE_SIZE,
      total: 0,
      total_pages: 1
    })
  })

  it('falls back to the same empty shape when the request fails', async () => {
    vi.mocked(queryRequest).mockRejectedValue(new Error('Network down'))
    const { wrapper } = createQueryWrapper()

    const { result } = renderHook(() => useUserContent(7, 'topics', 1), { wrapper })

    await waitFor(() => expect(result.current.isFetchingItems).toBe(false))

    expect(result.current.items).toEqual([])
    expect(result.current.pagination.total).toBe(0)
  })
})

// A profile URL carries a slug that has to resolve to an id before anything can
// be asked for. Firing the request on a half-resolved route would ask for
// `users/NaN/topics`.
describe('a member id that is not yet usable', () => {
  it('asks for nothing at all', () => {
    const { wrapper } = createQueryWrapper()

    for (const id of [undefined, 0, -1, 'not-a-number']) {
      renderHook(() => useUserContent(id, 'topics', 1), { wrapper })
    }

    expect(queryRequest).not.toHaveBeenCalled()
  })

  it('accepts an id that arrived as text', async () => {
    vi.mocked(queryRequest).mockResolvedValue(page([]) as never)
    const { wrapper } = createQueryWrapper()

    renderHook(() => useUserContent('7', 'topics', 1), { wrapper })

    await waitFor(() =>
      expect(queryRequest).toHaveBeenCalledWith(
        'users/7/topics',
        expect.anything(),
        expect.anything(),
        'GET',
        expect.anything()
      )
    )
  })

  it('asks for nothing when the caller has disabled the tab', () => {
    const { wrapper } = createQueryWrapper()

    renderHook(() => useUserContent(7, 'votes', 1, { enabled: false }), { wrapper })

    expect(queryRequest).not.toHaveBeenCalled()
  })
})

describe('moving between pages and tabs', () => {
  // Paging should not collapse the list to a spinner and jump the scroll
  // position.
  it('keeps the page it has while the next page of the same tab loads', async () => {
    vi.mocked(queryRequest).mockResolvedValue(page([{ ID: 1 }]) as never)
    const { wrapper } = createQueryWrapper()

    const { rerender, result } = renderHook(
      ({ page: current }) => useUserContent(7, 'topics', current),
      {
        initialProps: { page: 1 },
        wrapper
      }
    )

    await waitFor(() => expect(result.current.items).toHaveLength(1))

    vi.mocked(queryRequest).mockReturnValue(
      new Promise(() => {
        /* never settles */
      }) as never
    )
    rerender({ page: 2 })

    expect(result.current.items).toHaveLength(1)
  })

  // Held across tabs it would hand the comments list the topics it was showing
  // a moment ago, and those have none of the fields a comment row reads.
  it('shows nothing rather than the other tab’s rows when the tab changes', async () => {
    vi.mocked(queryRequest).mockResolvedValue(page([{ ID: 1 }]) as never)
    const { wrapper } = createQueryWrapper()

    const { rerender, result } = renderHook(({ tab }) => useUserContent(7, tab, 1), {
      initialProps: { tab: 'topics' as const },
      wrapper
    })

    await waitFor(() => expect(result.current.items).toHaveLength(1))

    vi.mocked(queryRequest).mockReturnValue(
      new Promise(() => {
        /* never settles */
      }) as never
    )
    rerender({ tab: 'comments' as never })

    expect(result.current.items).toEqual([])
  })
})
