/* eslint-disable translate-obj-prop/translate-obj-prop -- fixtures are wire data, not user-facing copy */
import { request } from '@common/request'
import { renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { createQueryWrapper } from '../../../config/test-query-wrapper'
import useActivityLog, { useActivityActions } from './use-activity-log'

vi.mock('@common/request', () => ({ request: vi.fn() }))

const page = (rows: unknown[] = []) => ({
  code: 'SUCCESS',
  data: {
    data: rows,
    pagination: { current_page: 1, per_page: 20, total: rows.length, total_pages: 1 }
  },
  status: 'success'
})

/** The query parameters the hook actually sent. */
const sentQuery = () =>
  (vi.mocked(request).mock.calls[0][1] as { queryParam: Record<string, unknown> }).queryParam

beforeEach(() => {
  vi.clearAllMocks()
})

describe('reading the log', () => {
  it('sends the filters the screen is showing', async () => {
    vi.mocked(request).mockResolvedValue(page() as never)
    const { wrapper } = createQueryWrapper()

    renderHook(() => useActivityLog({ action: 'hide', page: 2 }), { wrapper })

    await waitFor(() => expect(request).toHaveBeenCalled())

    expect(sentQuery()).toEqual({ action: 'hide', page: 2 })
  })

  // The server reads an empty action as "no filter", but an explicitly sent
  // empty string still has to be validated against the enum on arrival.
  it('leaves an unset filter out rather than sending it empty', async () => {
    vi.mocked(request).mockResolvedValue(page() as never)
    const { wrapper } = createQueryWrapper()

    renderHook(() => useActivityLog({ action: '', actor: undefined, page: 1, target_type: '' }), {
      wrapper
    })

    await waitFor(() => expect(request).toHaveBeenCalled())

    expect(sentQuery()).toEqual({ page: 1 })
  })

  // Actor zero is nobody and target zero is nothing, so neither is a filter.
  it('leaves a zero out too', async () => {
    vi.mocked(request).mockResolvedValue(page() as never)
    const { wrapper } = createQueryWrapper()

    renderHook(() => useActivityLog({ actor: 0, page: 1, target_id: 0 }), { wrapper })

    await waitFor(() => expect(request).toHaveBeenCalled())

    expect(sentQuery()).toEqual({ page: 1 })
  })

  it('keeps a filter that names one piece of content', async () => {
    vi.mocked(request).mockResolvedValue(page() as never)
    const { wrapper } = createQueryWrapper()

    renderHook(() => useActivityLog({ target_id: 1491, target_type: 'post' }), { wrapper })

    await waitFor(() => expect(request).toHaveBeenCalled())

    expect(sentQuery()).toEqual({ target_id: 1491, target_type: 'post' })
  })

  it('unwraps the log out of the envelope', async () => {
    vi.mocked(request).mockResolvedValue(page([{ action: 'hide', id: 1 }]) as never)
    const { wrapper } = createQueryWrapper()

    const { result } = renderHook(() => useActivityLog({}), { wrapper })

    await waitFor(() => expect(result.current.activityLog?.data).toHaveLength(1))
  })

  it('reports a failure rather than an empty log', async () => {
    vi.mocked(request).mockRejectedValue(new Error('Network down'))
    const { wrapper } = createQueryWrapper()

    const { result } = renderHook(() => useActivityLog({}), { wrapper })

    await waitFor(() => expect(result.current.isActivityLogError).toBe(true))
  })

  // Without this the table empties on every page change and the layout jumps.
  it('keeps the page it has while the next one loads', async () => {
    vi.mocked(request).mockResolvedValue(page([{ action: 'hide', id: 1 }]) as never)
    const { wrapper } = createQueryWrapper()

    const { rerender, result } = renderHook(({ filters }) => useActivityLog(filters), {
      initialProps: { filters: { page: 1 } },
      wrapper
    })

    await waitFor(() => expect(result.current.activityLog?.data).toHaveLength(1))

    vi.mocked(request).mockReturnValue(
      new Promise(() => {
        /* never settles */
      }) as never
    )
    rerender({ filters: { page: 2 } })

    expect(result.current.activityLog?.data).toHaveLength(1)
  })
})

// Read from the server so the enum stays in one place rather than being
// duplicated into the filter dropdown.
describe('the list of actions to filter by', () => {
  it('reads the actions the server knows about', async () => {
    vi.mocked(request).mockResolvedValue({
      data: [{ label: 'Hid content', value: 'hide' }]
    } as never)
    const { wrapper } = createQueryWrapper()

    const { result } = renderHook(() => useActivityActions(), { wrapper })

    await waitFor(() => expect(result.current.activityActions).toHaveLength(1))
  })

  // The dropdown maps over this, so it must never be undefined.
  it('is an empty list until the server answers', () => {
    vi.mocked(request).mockReturnValue(
      new Promise(() => {
        /* never settles */
      }) as never
    )
    const { wrapper } = createQueryWrapper()

    const { result } = renderHook(() => useActivityActions(), { wrapper })

    expect(result.current.activityActions).toEqual([])
  })

  it('is an empty list when the request fails', async () => {
    vi.mocked(request).mockRejectedValue(new Error('Network down'))
    const { wrapper } = createQueryWrapper()

    const { result } = renderHook(() => useActivityActions(), { wrapper })

    await waitFor(() => expect(result.current.activityActions).toEqual([]))
  })
})
