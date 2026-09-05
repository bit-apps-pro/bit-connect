import { request } from '@common/request'
import { renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { createQueryWrapper } from '../../../config/test-query-wrapper'
import useGeneralSettings from './use-general-settings'

vi.mock('@common/request', () => ({ request: vi.fn() }))

const stored = (settings: Record<string, unknown>) => ({
  code: 'SUCCESS',
  data: settings,
  status: 'success'
})

const load = async (settings: Record<string, unknown>) => {
  vi.mocked(request).mockResolvedValue(stored(settings) as never)
  const { wrapper } = createQueryWrapper()

  const { result } = renderHook(() => useGeneralSettings(), { wrapper })

  await waitFor(() => expect(result.current.isGeneralSettingsFetching).toBe(false))

  return result
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('the general settings screen’s values', () => {
  it('reads back what the server stored', async () => {
    const result = await load({
      communityTitle: 'Acme Community',
      logoPermalinkMode: 'custom',
      portalAccess: 'members'
    })

    expect(result.current.generalSettings.communityTitle).toBe('Acme Community')
    expect(result.current.generalSettings.portalAccess).toBe('members')
    expect(result.current.generalSettings.logoPermalinkMode).toBe('custom')
  })

  it('shows the defaults before anything has arrived', () => {
    vi.mocked(request).mockReturnValue(
      new Promise(() => {
        /* never settles */
      }) as never
    )
    const { wrapper } = createQueryWrapper()

    const { result } = renderHook(() => useGeneralSettings(), { wrapper })

    expect(result.current.generalSettings.portalAccess).toBe('everyone')
    expect(result.current.generalSettings.communityTitle).toBe('')
  })
})

// An install saved before this setting existed returns no portalFilters at all,
// and a partial object must not blank out the keys it happens to omit.
describe('the portal’s filter switches', () => {
  it('are all on for an install that predates them', async () => {
    const result = await load({ communityTitle: 'Acme' })

    expect(result.current.generalSettings.portalFilters).toEqual({
      product: true,
      sort: true,
      tags: true
    })
  })

  it('fill in only the keys a partial payload left out', async () => {
    const result = await load({ portalFilters: { tags: false } })

    expect(result.current.generalSettings.portalFilters).toEqual({
      product: true,
      sort: true,
      tags: false
    })
  })
})

// The card is an outbound link on pages the site owner published, so it may
// only appear where an admin asked for it.
describe('the promo card', () => {
  it('stays off for an install that never saw the setting', async () => {
    const result = await load({ communityTitle: 'Acme' })

    expect(result.current.generalSettings.promo).toEqual({
      cta: '',
      enabled: false,
      eyebrow: '',
      headline: '',
      phrases: [],
      prefix: '',
      url: ''
    })
  })

  // `=== true`, not `??`: a stored '' from an older payload must read as off.
  it('stays off for anything that is not exactly true', async () => {
    for (const enabled of ['', '1', 1, 'true', undefined]) {
      const result = await load({ promo: { enabled } })

      expect(result.current.generalSettings.promo.enabled).toBe(false)
    }
  })

  it('comes on only when it was deliberately turned on', async () => {
    const result = await load({ promo: { enabled: true, url: 'https://example.com' } })

    expect(result.current.generalSettings.promo.enabled).toBe(true)
    expect(result.current.generalSettings.promo.url).toBe('https://example.com')
  })

  // The typewriter maps over this, so a stored value of the wrong shape must
  // not reach it.
  it('reads the rotating phrases as a list or as none at all', async () => {
    const withPhrases = await load({ promo: { phrases: ['one', 'two'] } })
    expect(withPhrases.current.generalSettings.promo.phrases).toEqual(['one', 'two'])

    const corrupted = await load({ promo: { phrases: 'one, two' } })
    expect(corrupted.current.generalSettings.promo.phrases).toEqual([])
  })
})
