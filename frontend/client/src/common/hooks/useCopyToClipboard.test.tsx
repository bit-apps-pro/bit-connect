import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import useCopyToClipboard from './useCopyToClipboard'

// "Copied" is the only feedback a copy button gives, so it has to mean the text
// is actually on the clipboard. Announcing it up front made it a promise the
// page could not keep: a denied clipboard permission rejects, and the reader
// pastes whatever they copied last believing it was this link.
/** Puts a working clipboard behind a secure context. */
function withClipboard(writeText: () => Promise<void>) {
  vi.stubGlobal('isSecureContext', true)
  Object.defineProperty(window, 'isSecureContext', { configurable: true, value: true })
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } })
}

describe('useCopyToClipboard', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.spyOn(console, 'error').mockImplementation(() => {
      /* silenced */
    })
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('starts with nothing copied', () => {
    const { result } = renderHook(() => useCopyToClipboard())

    expect(result.current.copied).toBe(false)
  })

  it('confirms only once the write has resolved', async () => {
    let settle!: () => void
    withClipboard(
      () =>
        new Promise<void>(resolve => {
          settle = resolve
        })
    )

    const { result } = renderHook(() => useCopyToClipboard())

    act(() => result.current.copy('https://example.com/topic'))
    expect(result.current.copied).toBe(false)

    await act(async () => {
      settle()
    })

    expect(result.current.copied).toBe(true)
  })

  it('writes what it was given', async () => {
    // eslint-disable-next-line unicorn/no-useless-undefined -- writeText resolves with nothing
    const writeText = vi.fn().mockResolvedValue(undefined)
    withClipboard(writeText)

    const { result } = renderHook(() => useCopyToClipboard())

    await act(async () => {
      result.current.copy('https://example.com/topic')
    })

    expect(writeText).toHaveBeenCalledWith('https://example.com/topic')
  })

  // A reader who was refused must not be told the link is on their clipboard.
  it('stays silent when the browser refuses', async () => {
    withClipboard(() => Promise.reject(new Error('Permission denied')))

    const { result } = renderHook(() => useCopyToClipboard())

    await act(async () => {
      result.current.copy('https://example.com/topic')
    })

    expect(result.current.copied).toBe(false)
    expect(console.error).toHaveBeenCalled()
  })

  it('goes back to its resting state after a few seconds', async () => {
    withClipboard(() => Promise.resolve())

    const { result } = renderHook(() => useCopyToClipboard())

    await act(async () => {
      result.current.copy('https://example.com/topic')
    })

    expect(result.current.copied).toBe(true)

    act(() => {
      vi.advanceTimersByTime(2500)
    })

    expect(result.current.copied).toBe(false)
  })

  // Plain http, an iframe without permission, an old browser: the fallback is
  // what keeps the button working at all there.
  it('falls back to a hidden textarea outside a secure context', () => {
    Object.defineProperty(window, 'isSecureContext', { configurable: true, value: false })
    const execCommand = vi.fn().mockReturnValue(true)
    Object.defineProperty(document, 'execCommand', { configurable: true, value: execCommand })

    const { result } = renderHook(() => useCopyToClipboard())

    act(() => result.current.copy('https://example.com/topic'))

    expect(execCommand).toHaveBeenCalledWith('copy')
    expect(result.current.copied).toBe(true)
    expect(document.querySelector('textarea')).toBeNull()
  })

  it('stays silent when even the fallback fails', () => {
    Object.defineProperty(window, 'isSecureContext', { configurable: true, value: false })
    Object.defineProperty(document, 'execCommand', {
      configurable: true,
      value: vi.fn(() => {
        throw new Error('not supported')
      })
    })

    const { result } = renderHook(() => useCopyToClipboard())

    act(() => result.current.copy('https://example.com/topic'))

    expect(result.current.copied).toBe(false)
  })
})
