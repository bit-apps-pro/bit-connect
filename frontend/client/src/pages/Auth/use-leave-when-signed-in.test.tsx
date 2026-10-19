import { renderHook } from '@testing-library/react'
import { type ReactNode } from 'react'
import { MemoryRouter, useLocation } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import config from '@/config/config'

import useLeaveWhenSignedIn from './use-leave-when-signed-in'

// Signing in on the portal used to move the visitor on inside the app, so the
// page kept what the server rendered for a guest: IS_LOGGED_IN false, no unread
// count. The notification queries are gated on that flag, and the bell stayed
// empty until the member reloaded.

const replace = vi.fn()
/** The fields this test sets; config is read-only everywhere else. */
const settable = config as { IS_LOGGED_IN: boolean; POST_URL: string; SITE_URL: string }
const initial = { IS_LOGGED_IN: config.IS_LOGGED_IN, POST_URL: config.POST_URL, SITE_URL: config.SITE_URL }

function wrapper({ children }: { children: ReactNode }) {
  return <MemoryRouter initialEntries={['/login']}>{children}</MemoryRouter>
}

function render(isLoggedIn: boolean, redirectTo = '/some-post') {
  return renderHook(
    () => {
      useLeaveWhenSignedIn(isLoggedIn, redirectTo)
      return useLocation().pathname
    },
    { wrapper }
  )
}

describe('useLeaveWhenSignedIn', () => {
  beforeEach(() => {
    settable.SITE_URL = 'https://example.test'
    settable.POST_URL = '/community'
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { ...window.location, replace }
    })
  })

  afterEach(() => {
    replace.mockReset()
    Object.assign(settable, initial)
  })

  it('stays on the page while the visitor is a guest', () => {
    settable.IS_LOGGED_IN = false
    const { result } = render(false)

    expect(replace).not.toHaveBeenCalled()
    expect(result.current).toBe('/login')
  })

  it('loads the target page fresh after a sign-in on this page', () => {
    settable.IS_LOGGED_IN = false
    const { result } = render(true)

    expect(replace).toHaveBeenCalledTimes(1)
    expect(replace.mock.calls[0][0]).toMatch(/^https:\/\/example\.test\/community\/some-post\/?$/)
    expect(result.current).toBe('/login')
  })

  it('moves inside the app when the page was already signed in', () => {
    settable.IS_LOGGED_IN = true
    const { result } = render(true)

    expect(replace).not.toHaveBeenCalled()
    expect(result.current).toBe('/some-post')
  })
})
