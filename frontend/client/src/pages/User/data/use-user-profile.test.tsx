import queryRequest from '@common/helpers/request'
import { renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { createQueryWrapper } from '../../../config/test-query-wrapper'
import useUserProfile from './use-user-profile'

vi.mock('@common/helpers/request', () => ({ default: vi.fn() }))

const profile = (overrides: Record<string, unknown> = {}) => ({
  data: {
    stats: { comments: 4, topics: 2, upvotes: 9 },
    user: { display_name: 'Rahim', id: 7, slug: 'rahim', ...overrides }
  }
})

beforeEach(() => {
  vi.clearAllMocks()
})

// One request rather than two: the header renders the name and the numbers
// together, and splitting them makes the stats pop in after the name has
// already painted.
describe('loading a profile', () => {
  it('asks for the slug from the URL', async () => {
    vi.mocked(queryRequest).mockResolvedValue(profile() as never)
    const { wrapper } = createQueryWrapper()

    renderHook(() => useUserProfile('rahim'), { wrapper })

    await waitFor(() =>
      expect(queryRequest).toHaveBeenCalledWith(
        'users/rahim/profile',
        {},
        undefined,
        'GET',
        expect.anything()
      )
    )
  })

  // A slug can carry anything sanitize_title() stored, including percent-encoded
  // non-Latin script — pasted into a path unescaped it would break the route.
  it('escapes the slug into the path', async () => {
    vi.mocked(queryRequest).mockResolvedValue(profile() as never)
    const { wrapper } = createQueryWrapper()

    renderHook(() => useUserProfile('rahim ahmed/../admin'), { wrapper })

    await waitFor(() =>
      expect(queryRequest).toHaveBeenCalledWith(
        `users/${encodeURIComponent('rahim ahmed/../admin')}/profile`,
        {},
        undefined,
        'GET',
        expect.anything()
      )
    )
  })

  it('hands back the identity and the totals together', async () => {
    vi.mocked(queryRequest).mockResolvedValue(profile() as never)
    const { wrapper } = createQueryWrapper()

    const { result } = renderHook(() => useUserProfile('rahim'), { wrapper })

    await waitFor(() => expect(result.current.profile?.display_name).toBe('Rahim'))

    expect(result.current.stats?.topics).toBe(2)
    expect(result.current.notFound).toBe(false)
  })

  // The rest of the page is addressed by numeric id, which only arrives with
  // this response — so this is the resolution step for everything after it.
  it('resolves the slug to the id the other endpoints key off', async () => {
    vi.mocked(queryRequest).mockResolvedValue(profile() as never)
    const { wrapper } = createQueryWrapper()

    const { result } = renderHook(() => useUserProfile('rahim'), { wrapper })

    await waitFor(() => expect(result.current.userId).toBe(7))
  })
})

describe('a profile that is not there', () => {
  it('reads a failed request as not found', async () => {
    vi.mocked(queryRequest).mockRejectedValue(new Error('404'))
    const { wrapper } = createQueryWrapper()

    const { result } = renderHook(() => useUserProfile('nobody'), { wrapper })

    await waitFor(() => expect(result.current.notFound).toBe(true))
  })

  it('reads an answer carrying no member as not found', async () => {
    vi.mocked(queryRequest).mockResolvedValue({ data: { stats: undefined, user: undefined } } as never)
    const { wrapper } = createQueryWrapper()

    const { result } = renderHook(() => useUserProfile('nobody'), { wrapper })

    await waitFor(() => expect(result.current.notFound).toBe(true))
  })

  // `enabled: false` leaves the query idle rather than errored, so a missing
  // slug has to be treated as not found rather than as a page still loading.
  it('reads a missing slug as not found without asking for anything', () => {
    const { wrapper } = createQueryWrapper()

    // eslint-disable-next-line unicorn/no-useless-undefined -- a route with no slug is the case under test
    const { result } = renderHook(() => useUserProfile(undefined), { wrapper })

    expect(result.current.notFound).toBe(true)
    expect(queryRequest).not.toHaveBeenCalled()
  })

  // Otherwise the page flashes "not found" before the profile arrives.
  it('is not "not found" while the profile is still loading', () => {
    vi.mocked(queryRequest).mockReturnValue(
      new Promise(() => {
        /* never settles */
      }) as never
    )
    const { wrapper } = createQueryWrapper()

    const { result } = renderHook(() => useUserProfile('rahim'), { wrapper })

    expect(result.current.isLoadingProfile).toBe(true)
    expect(result.current.notFound).toBe(false)
  })
})
