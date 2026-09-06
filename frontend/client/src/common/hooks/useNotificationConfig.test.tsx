import { act, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  NOTIFICATION_SETTINGS,
  notificationOptions,
  placementFor,
  useIsMobileViewport,
  useNotificationConfig,
  useResponsiveNotification
} from './useNotificationConfig'

/**
 * Stands in for matchMedia, remembering the listener so a test can move the
 * viewport after mount — which is the case the whole hook exists for.
 */
function stubViewport(isMobile: boolean) {
  const listeners: ((event: MediaQueryListEvent) => void)[] = []

  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: vi.fn().mockImplementation(query => ({
      addEventListener: (_: string, listener: (event: MediaQueryListEvent) => void) =>
        listeners.push(listener),
      matches: isMobile,
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
    resizeTo: (nowMobile: boolean) => {
      for (const listener of listeners) listener({ matches: nowMobile } as MediaQueryListEvent)
    }
  }
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('placementFor', () => {
  // The on-screen keyboard covers the bottom of a phone's viewport, and the
  // errors most likely to fire — upload rejected, comment failed — happen while
  // the reader is typing. A bottom toast would appear behind the keyboard.
  it('anchors to the top on a phone', () => {
    expect(placementFor(true)).toEqual({
      placement: 'top',
      top: NOTIFICATION_SETTINGS.mobile.offset
    })
  })

  it('anchors to the bottom corner on a desktop', () => {
    expect(placementFor(false)).toEqual({
      bottom: NOTIFICATION_SETTINGS.desktop.offset,
      placement: 'bottomRight'
    })
  })

  // Passing both would leave Ant Design to pick, and it picks the wrong one.
  it('sets only the offset that belongs to its side', () => {
    expect(placementFor(true)).not.toHaveProperty('bottom')
    expect(placementFor(false)).not.toHaveProperty('top')
  })
})

describe('notificationOptions', () => {
  // An error is the one toast a reader has to finish reading, and the one they
  // are least likely to have been looking at when it appeared.
  it('leaves an error up for longer than an ordinary toast', () => {
    expect(notificationOptions('error').duration).toBeGreaterThan(
      notificationOptions().duration as number
    )
  })

  it('uses the ordinary duration when no severity is given', () => {
    expect(notificationOptions()).toEqual({ duration: NOTIFICATION_SETTINGS.duration.default })
  })
})

describe('useNotificationConfig', () => {
  it('carries the placement for the viewport it was created in', () => {
    stubViewport(true)

    const { result } = renderHook(() => useNotificationConfig())

    expect(result.current.placement).toBe('top')
    expect(result.current.duration).toBe(NOTIFICATION_SETTINGS.duration.default)
  })

  // Three at once is already a stack the reader has to work through.
  it('caps how many toasts can pile up', () => {
    stubViewport(false)

    expect(renderHook(() => useNotificationConfig()).result.current.maxCount).toBe(3)
  })
})

describe('useIsMobileViewport', () => {
  it('reports the viewport it starts in', () => {
    stubViewport(true)

    expect(renderHook(() => useIsMobileViewport()).result.current).toBe(true)
  })

  it('follows the viewport when it changes', () => {
    const viewport = stubViewport(false)
    const { result } = renderHook(() => useIsMobileViewport())

    expect(result.current).toBe(false)

    act(() => viewport.resizeTo(true))

    expect(result.current).toBe(true)
  })

  it('stops listening once the component is gone', () => {
    const viewport = stubViewport(false)
    const { unmount } = renderHook(() => useIsMobileViewport())

    expect(viewport.listenerCount()).toBe(1)

    unmount()

    expect(viewport.listenerCount()).toBe(0)
  })

  // The portal prerenders, and there is no window there to measure.
  it('assumes a desktop where there is no viewport to measure', () => {
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      value: undefined,
      writable: true
    })

    expect(renderHook(() => useIsMobileViewport()).result.current).toBe(false)
  })
})

/** A stand-in for Ant Design's notification instance. */
function api() {
  return {
    destroy: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    open: vi.fn(),
    success: vi.fn(),
    warning: vi.fn()
  }
}

describe('useResponsiveNotification', () => {
  it('adds the placement to every call so a call site need not', () => {
    stubViewport(false)
    const notification = api()

    const { result } = renderHook(() => useResponsiveNotification(notification as never))

    result.current.error({ message: 'Upload rejected' })

    expect(notification.error).toHaveBeenCalledWith({
      bottom: NOTIFICATION_SETTINGS.desktop.offset,
      message: 'Upload rejected',
      placement: 'bottomRight'
    })
  })

  // Ant Design reads the holder's config once, so without this a toast stays
  // anchored wherever the page happened to load.
  it('uses the placement for the viewport as it is now, not as it was at mount', () => {
    const viewport = stubViewport(false)
    const notification = api()

    const { result } = renderHook(() => useResponsiveNotification(notification as never))

    act(() => viewport.resizeTo(true))
    result.current.success({ message: 'Saved' })

    expect(notification.success).toHaveBeenCalledWith({
      message: 'Saved',
      placement: 'top',
      top: NOTIFICATION_SETTINGS.mobile.offset
    })
  })

  it('lets a call site override the placement it was given', () => {
    stubViewport(false)
    const notification = api()

    const { result } = renderHook(() => useResponsiveNotification(notification as never))

    result.current.info({ message: 'Note', placement: 'topLeft' })

    expect(notification.info).toHaveBeenCalledWith(expect.objectContaining({ placement: 'topLeft' }))
  })

  it('wraps every severity the call sites use', () => {
    stubViewport(false)
    const notification = api()

    const { result } = renderHook(() => useResponsiveNotification(notification as never))

    for (const severity of ['error', 'info', 'open', 'success', 'warning'] as const) {
      result.current[severity]({ message: severity })

      expect(notification[severity]).toHaveBeenCalledWith(
        expect.objectContaining({ placement: 'bottomRight' })
      )
    }
  })
})
