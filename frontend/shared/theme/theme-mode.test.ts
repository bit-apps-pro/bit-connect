import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  applyThemeToDocument,
  DARK_CLASS,
  isThemeMode,
  readStoredMode,
  resolveIsDark,
  systemPrefersDark,
  type ThemeMode,
  watchSystemTheme
} from './theme-mode'

/**
 * A stand-in for `window.matchMedia`, which happy-dom implements as always
 * non-matching with no `change` events — so the real thing can neither report
 * dark nor be observed flipping.
 */
function stubMatchMedia(matches: boolean) {
  const listeners = new Set<(event: MediaQueryListEvent) => void>()
  const query = {
    addEventListener: (_: string, function_: (event: MediaQueryListEvent) => void) =>
      listeners.add(function_),
    matches,
    removeEventListener: (_: string, function_: (event: MediaQueryListEvent) => void) =>
      listeners.delete(function_)
  }

  vi.stubGlobal(
    'matchMedia',
    vi.fn(() => query)
  )

  return {
    emit: (prefersDark: boolean) => {
      for (const function_ of listeners) function_({ matches: prefersDark } as MediaQueryListEvent)
    },
    listenerCount: () => listeners.size
  }
}

afterEach(() => {
  vi.unstubAllGlobals()
  document.documentElement.className = ''
  document.documentElement.style.colorScheme = ''
})

describe('isThemeMode', () => {
  it('accepts the three modes and nothing else', () => {
    for (const mode of ['light', 'dark', 'system']) expect(isThemeMode(mode)).toBe(true)
    // eslint-disable-next-line unicorn/no-null -- null is in the accepted input union
    for (const value of ['auto', '', 'Dark', true, null, undefined, 0]) {
      expect(isThemeMode(value)).toBe(false)
    }
  })
})

describe('resolveIsDark', () => {
  it('ignores the system preference for the explicit modes', () => {
    expect(resolveIsDark('dark', false)).toBe(true)
    expect(resolveIsDark('light', true)).toBe(false)
  })

  it('follows the system preference in system mode', () => {
    expect(resolveIsDark('system', true)).toBe(true)
    expect(resolveIsDark('system', false)).toBe(false)
  })
})

describe('systemPrefersDark', () => {
  it('reports what the media query reports', () => {
    stubMatchMedia(true)
    expect(systemPrefersDark()).toBe(true)
  })

  // A prerendered portal evaluates this module in Node during the build.
  it('falls back to light where matchMedia does not exist', () => {
    // eslint-disable-next-line unicorn/no-useless-undefined -- stubGlobal requires the value
    vi.stubGlobal('matchMedia', undefined)
    expect(systemPrefersDark()).toBe(false)
  })
})

describe('watchSystemTheme', () => {
  it('reports flips and unsubscribes cleanly', () => {
    const media = stubMatchMedia(false)
    const onChange = vi.fn()

    const unsubscribe = watchSystemTheme(onChange)
    media.emit(true)
    expect(onChange).toHaveBeenCalledWith(true)

    unsubscribe()
    expect(media.listenerCount()).toBe(0)
    media.emit(false)
    expect(onChange).toHaveBeenCalledTimes(1)
  })

  it('returns a no-op unsubscribe where matchMedia does not exist', () => {
    // eslint-disable-next-line unicorn/no-useless-undefined -- stubGlobal requires the value
    vi.stubGlobal('matchMedia', undefined)
    expect(() => watchSystemTheme(vi.fn())()).not.toThrow()
  })
})

describe('applyThemeToDocument', () => {
  it('sets both the class and color-scheme, and clears them again', () => {
    const root = document.documentElement

    applyThemeToDocument(true)
    expect(root.classList.contains(DARK_CLASS)).toBe(true)
    expect(root.style.colorScheme).toBe('dark')

    applyThemeToDocument(false)
    expect(root.classList.contains(DARK_CLASS)).toBe(false)
    expect(root.style.colorScheme).toBe('light')
  })

  it('leaves unrelated classes on the element alone', () => {
    const root = document.documentElement
    root.className = 'bc-js'

    applyThemeToDocument(true)
    expect(root.classList.contains('bc-js')).toBe(true)
    applyThemeToDocument(false)
    expect(root.classList.contains('bc-js')).toBe(true)
  })
})

const stored = (value: unknown) => JSON.stringify(value)

describe('readStoredMode', () => {
  it('reads a stored mode', () => {
    for (const mode of ['light', 'dark', 'system'] as ThemeMode[]) {
      expect(readStoredMode(stored({ themeMode: mode }))).toBe(mode)
    }
  })

  // Installs that persisted the pre-modes boolean keep their theme.
  it('migrates the legacy isDarkTheme boolean', () => {
    expect(readStoredMode(stored({ isDarkTheme: true }))).toBe('dark')
    expect(readStoredMode(stored({ isDarkTheme: false }))).toBe('light')
  })

  it('prefers the mode over the legacy boolean when both are present', () => {
    expect(readStoredMode(stored({ isDarkTheme: true, themeMode: 'light' }))).toBe('light')
  })

  it('falls back to system for anything unusable', () => {
    // eslint-disable-next-line unicorn/no-null -- localStorage.getItem returns null
    for (const raw of [null, undefined, '', 'not json', '[]', '"dark"', stored({}), stored(null)]) {
      expect(readStoredMode(raw)).toBe('system')
    }
    expect(readStoredMode(stored({ themeMode: 'auto' }))).toBe('system')
    expect(readStoredMode(stored({ isDarkTheme: 'yes' }))).toBe('system')
  })
})
