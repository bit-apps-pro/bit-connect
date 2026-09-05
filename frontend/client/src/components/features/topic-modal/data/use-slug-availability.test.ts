import queryRequest from '@common/helpers/request'
import { renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { createQueryWrapper } from '../../../../config/test-query-wrapper'
import useSlugAvailability from './use-slug-availability'

vi.mock('@common/helpers/request', () => ({ default: vi.fn() }))

const mockRequest = vi.mocked(queryRequest)

const answer = (data: { available: boolean; requested: string; slug: string }) =>
  mockRequest.mockResolvedValue({ code: 'SUCCESS' as const, data, status: 'success' as const })

describe('useSlugAvailability', () => {
  beforeEach(() => {
    mockRequest.mockReset()
  })
  afterEach(() => {
    vi.clearAllMocks()
  })

  it('asks about nothing while the field is empty', () => {
    const { wrapper } = createQueryWrapper()

    const { result } = renderHook(() => useSlugAvailability(''), { wrapper })

    expect(mockRequest).not.toHaveBeenCalled()
    expect(result.current.isChecking).toBe(false)
  })

  // The input is only normalised on blur, so the raw text is what the hook
  // sees — asking about "My Slug" would never match a stored slug.
  it('asks about the slugified form of what was typed', async () => {
    answer({ available: true, requested: 'my-slug', slug: 'my-slug' })
    const { wrapper } = createQueryWrapper()

    renderHook(() => useSlugAvailability('My Slug'), { wrapper })

    await waitFor(() => expect(mockRequest).toHaveBeenCalledTimes(1))
    expect(mockRequest).toHaveBeenCalledWith(
      'topic-slug-check',
      undefined,
      { slug: 'my-slug' },
      'GET',
      expect.anything()
    )
  })

  it('sends the topic being edited so its own slug is not a clash', async () => {
    answer({ available: true, requested: 'kept', slug: 'kept' })
    const { wrapper } = createQueryWrapper()

    renderHook(() => useSlugAvailability('kept', 42), { wrapper })

    await waitFor(() => expect(mockRequest).toHaveBeenCalledTimes(1))
    expect(mockRequest).toHaveBeenCalledWith(
      'topic-slug-check',
      undefined,
      { slug: 'kept', topic_id: 42 },
      'GET',
      expect.anything()
    )
  })

  it('reports the slug the save would really use when the typed one is taken', async () => {
    answer({ available: false, requested: 'taken', slug: 'taken-2' })
    const { wrapper } = createQueryWrapper()

    const { result } = renderHook(() => useSlugAvailability('taken'), { wrapper })

    await waitFor(() => expect(result.current.isAvailable).toBe(false))
    expect(result.current.resolved).toBe('taken-2')
  })

  // A verdict names the slug it answered about, so one that arrives late — or
  // for a slug already typed past — must not be shown against the current one.
  it('ignores a verdict that answers a different slug', async () => {
    answer({ available: false, requested: 'something-else', slug: 'something-else-2' })
    const { wrapper } = createQueryWrapper()

    const { result } = renderHook(() => useSlugAvailability('current-slug'), { wrapper })

    await waitFor(() => expect(mockRequest).toHaveBeenCalled())
    expect(result.current.isAvailable).toBe(true)
    expect(result.current.resolved).toBe('current-slug')
  })

  // The check is advisory; the save is never blocked by it. A failure has to
  // read as "no objection", not as "taken".
  it('raises no objection when the check itself fails', async () => {
    mockRequest.mockRejectedValue(new Error('offline'))
    const { wrapper } = createQueryWrapper()

    const { result } = renderHook(() => useSlugAvailability('some-slug'), { wrapper })

    await waitFor(() => expect(result.current.isChecking).toBe(false))
    expect(result.current.isAvailable).toBe(true)
    expect(result.current.resolved).toBe('some-slug')
  })
})
