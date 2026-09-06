import { act, renderHook } from '@testing-library/react'
import { atom, useAtom, useAtomValue, useSetAtom } from 'jotai'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { $systemPrefersDark, createThemeAtoms, type ThemeConfig } from './theme-atoms'

/**
 * Ties the OS preference to something a test can move, which is the case the
 * subscription exists for: without it, "system" means "whatever the OS said
 * when the tab opened" and a visitor keeps the daytime theme until they reload.
 */
function stubSystemTheme(prefersDark: boolean) {
  const listeners: ((event: MediaQueryListEvent) => void)[] = []

  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: vi.fn().mockImplementation(query => ({
      addEventListener: (_: string, listener: (event: MediaQueryListEvent) => void) =>
        listeners.push(listener),
      matches: prefersDark,
      media: query,
      removeEventListener: (_: string, listener: (event: MediaQueryListEvent) => void) => {
        const index = listeners.indexOf(listener)
        if (index !== -1) listeners.splice(index, 1)
      }
    })),
    writable: true
  })

  return {
    listenerCount: () => listeners.length,
    switchTo: (nowDark: boolean) => {
      for (const listener of listeners) listener({ matches: nowDark } as MediaQueryListEvent)
    }
  }
}

const configAtom = (themeMode: ThemeConfig['themeMode']) => atom<ThemeConfig>({ themeMode })

afterEach(() => {
  vi.restoreAllMocks()
})

describe('resolving the theme', () => {
  it('follows the stored decision when there is one', () => {
    stubSystemTheme(true)
    const { $isDarkTheme } = createThemeAtoms(configAtom('light'))

    expect(renderHook(() => useAtomValue($isDarkTheme)).result.current).toBe(false)
  })

  it('follows the OS on system mode', () => {
    stubSystemTheme(true)
    const { $isDarkTheme } = createThemeAtoms(configAtom('system'))

    expect(renderHook(() => useAtomValue($isDarkTheme)).result.current).toBe(true)
  })

  it('follows the OS as it changes rather than as it was at load', () => {
    const system = stubSystemTheme(false)
    const { $isDarkTheme } = createThemeAtoms(configAtom('system'))

    const { result } = renderHook(() => {
      useAtomValue($systemPrefersDark)
      return useAtomValue($isDarkTheme)
    })

    expect(result.current).toBe(false)

    act(() => system.switchTo(true))

    expect(result.current).toBe(true)
  })

  // An explicit choice is a decision to stop following the OS.
  it('ignores the OS once a member has chosen', () => {
    const system = stubSystemTheme(false)
    const { $isDarkTheme } = createThemeAtoms(configAtom('dark'))

    const { result } = renderHook(() => {
      useAtomValue($systemPrefersDark)
      return useAtomValue($isDarkTheme)
    })

    act(() => system.switchTo(false))

    expect(result.current).toBe(true)
  })
})

describe('changing the theme', () => {
  it('writes the mode back into the app config it was built on', () => {
    stubSystemTheme(false)
    const $config = configAtom('light')
    const { $themeMode } = createThemeAtoms($config)

    const { result } = renderHook(() => ({
      config: useAtomValue($config),
      mode: useAtom($themeMode)
    }))

    act(() => result.current.mode[1]('dark'))

    expect(result.current.mode[0]).toBe('dark')
    expect(result.current.config.themeMode).toBe('dark')
  })

  // The mode is the stored decision and the boolean is a view of it. Nothing
  // else in the app config may be lost on the way through.
  it('leaves the rest of the app config alone', () => {
    stubSystemTheme(false)
    const $config = atom({ sidebarOpen: true, themeMode: 'light' as const })
    const { $themeMode } = createThemeAtoms($config as never)

    const { result } = renderHook(() => ({
      config: useAtomValue($config),
      setMode: useSetAtom($themeMode)
    }))

    act(() => result.current.setMode('dark'))

    expect(result.current.config).toEqual({ sidebarOpen: true, themeMode: 'dark' })
  })

  it('steps light → dark → system → light', () => {
    stubSystemTheme(false)
    const { $cycleThemeMode, $themeMode } = createThemeAtoms(configAtom('light'))

    const { result } = renderHook(() => ({
      cycle: useSetAtom($cycleThemeMode),
      mode: useAtomValue($themeMode)
    }))

    act(() => result.current.cycle())
    expect(result.current.mode).toBe('dark')

    act(() => result.current.cycle())
    expect(result.current.mode).toBe('system')

    act(() => result.current.cycle())
    expect(result.current.mode).toBe('light')
  })
})

describe('the OS preference atom', () => {
  it('picks up the current preference on mount', () => {
    stubSystemTheme(true)

    expect(renderHook(() => useAtomValue($systemPrefersDark)).result.current).toBe(true)
  })

  it('stops listening once nothing is using it', () => {
    const system = stubSystemTheme(false)
    const { unmount } = renderHook(() => useAtomValue($systemPrefersDark))

    expect(system.listenerCount()).toBe(1)

    unmount()

    expect(system.listenerCount()).toBe(0)
  })
})
