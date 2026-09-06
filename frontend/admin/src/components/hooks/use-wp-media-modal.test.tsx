import { renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { useWpMediaModal } from './use-wp-media-modal'

/**
 * Stands in for the media frame wp.media() returns.
 *
 * The chain the hook walks — state().get('selection').first().toJSON() — is
 * four calls deep into a global this code does not own, which is exactly the
 * kind of thing that breaks silently when it changes.
 */
function stubMediaLibrary(attachment: Record<string, unknown>) {
  const handlers: Record<string, () => void> = {}
  const open = vi.fn()

  const frame = {
    on: (event: string, handler: () => void) => {
      handlers[event] = handler
    },
    open,
    state: () => ({
      get: () => ({ first: () => ({ toJSON: () => attachment }) })
    })
  }

  const media = vi.fn().mockReturnValue(frame)

  Object.defineProperty(window, 'wp', { configurable: true, value: { media }, writable: true })

  return { media, open, select: () => handlers.select?.() }
}

beforeEach(() => {
  vi.spyOn(console, 'warn').mockImplementation(() => {
    /* silenced */
  })
})

afterEach(() => {
  vi.restoreAllMocks()

  Object.defineProperty(window, 'wp', { configurable: true, value: undefined, writable: true })
})

describe('opening the media library', () => {
  it('opens a single-select image picker by default', () => {
    const library = stubMediaLibrary({ id: 12, url: 'https://example.com/icon.png' })

    const { result } = renderHook(() => useWpMediaModal())

    result.current.openMediaModal({ onSelect: vi.fn() })

    expect(library.media).toHaveBeenCalledWith(
      expect.objectContaining({ library: { type: 'image' }, multiple: false })
    )
    expect(library.open).toHaveBeenCalled()
  })

  it('honours a different library type and multi-select', () => {
    const library = stubMediaLibrary({ id: 12, url: 'https://example.com/doc.pdf' })

    const { result } = renderHook(() => useWpMediaModal())

    result.current.openMediaModal({
      library: { type: 'application/pdf' },
      multiple: true,
      onSelect: vi.fn()
    })

    expect(library.media).toHaveBeenCalledWith(
      expect.objectContaining({ library: { type: 'application/pdf' }, multiple: true })
    )
  })

  it('hands the caller what was picked', () => {
    const library = stubMediaLibrary({
      filename: 'icon.png',
      filesizeInBytes: 2048,
      id: 12,
      url: 'https://example.com/icon.png'
    })
    const onSelect = vi.fn()

    const { result } = renderHook(() => useWpMediaModal())

    result.current.openMediaModal({ onSelect })
    library.select()

    expect(onSelect).toHaveBeenCalledWith({
      fileName: 'icon.png',
      fileSize: 2048,
      id: 12,
      url: 'https://example.com/icon.png'
    })
  })

  // Older attachments carry no filename of their own, and the field beside the
  // picker would otherwise show nothing at all.
  it('falls back to the last part of the URL for a file with no name', () => {
    const library = stubMediaLibrary({ id: 12, url: 'https://example.com/uploads/icon.png' })
    const onSelect = vi.fn()

    const { result } = renderHook(() => useWpMediaModal())

    result.current.openMediaModal({ onSelect })
    library.select()

    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ fileName: 'icon.png' }))
  })

  it('reports no name at all rather than an empty one', () => {
    const library = stubMediaLibrary({ id: 12, url: '' })
    const onSelect = vi.fn()

    const { result } = renderHook(() => useWpMediaModal())

    result.current.openMediaModal({ onSelect })
    library.select()

    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ fileName: undefined }))
  })

  // The admin screens run inside wp-admin, where wp.media is enqueued — but a
  // screen rendered before it loads must not take the page down with it.
  it('does nothing rather than throwing when the media library is absent', () => {
    const onSelect = vi.fn()

    const { result } = renderHook(() => useWpMediaModal())

    expect(() => result.current.openMediaModal({ onSelect })).not.toThrow()
    expect(onSelect).not.toHaveBeenCalled()
    expect(console.warn).toHaveBeenCalled()
  })

  // Passed into memoised children, so a new identity every render would
  // re-render the whole picker on every keystroke elsewhere on the screen.
  it('keeps the same opener across renders', () => {
    const { rerender, result } = renderHook(() => useWpMediaModal())

    const first = result.current.openMediaModal
    rerender()

    expect(result.current.openMediaModal).toBe(first)
  })
})
