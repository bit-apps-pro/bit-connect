import { act, renderHook } from '@testing-library/react'
import { type ReactNode } from 'react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router'
import { describe, expect, it } from 'vitest'

import useRouteTab from './use-route-tab'

const TABS = ['branding', 'location', 'access'] as const

/** Mounts the hook under a `general/:tab?` route, opened at `path`. */
function renderAt(path: string) {
  const wrapper = ({ children }: { children: ReactNode }) => (
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route element={children} path="general/:tab?" />
      </Routes>
    </MemoryRouter>
  )

  return renderHook(() => ({ ...useRouteTab('/general', TABS), pathname: useLocation().pathname }), { wrapper })
}

describe('useRouteTab', () => {
  it('opens the first tab at the bare screen address', () => {
    const { result } = renderAt('/general')
    expect(result.current.activeTab).toBe('branding')
  })

  it('opens the tab named in the address, so a refresh keeps it', () => {
    const { result } = renderAt('/general/location')
    expect(result.current.activeTab).toBe('location')
  })

  it('falls back to the first tab for a tab the screen does not have', () => {
    const { result } = renderAt('/general/nope')
    expect(result.current.activeTab).toBe('branding')
  })

  it('writes the chosen tab into the address', () => {
    const { result } = renderAt('/general')
    act(() => result.current.setActiveTab('access'))
    expect(result.current.pathname).toBe('/general/access')
    expect(result.current.activeTab).toBe('access')
  })

  it('returns to the bare address for the first tab, so the default has one address', () => {
    const { result } = renderAt('/general/access')
    act(() => result.current.setActiveTab('branding'))
    expect(result.current.pathname).toBe('/general')
    expect(result.current.activeTab).toBe('branding')
  })
})
