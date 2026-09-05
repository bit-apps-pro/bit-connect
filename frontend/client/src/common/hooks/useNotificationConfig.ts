import {
  type ArgsProps,
  type NotificationConfig,
  type NotificationInstance
} from 'antd/es/notification/interface'
import { useEffect, useMemo, useState } from 'react'

/**
 * Single place to tune how toasts appear. Adjust these rather than passing
 * placement/duration at each call site, so every notification in the portal
 * stays consistent.
 */
export const NOTIFICATION_SETTINGS = {
  /** Viewport width (px) below which the mobile layout is used. */
  mobileBreakpoint: 768,

  /** Seconds a toast stays on screen, by severity. 0 means "until dismissed". */
  duration: {
    default: 5,
    error: 8
  },

  desktop: {
    /** Distance (px) from the bottom edge. */
    offset: 24,
    placement: 'bottomRight' as const
  },

  mobile: {
    /** Distance (px) from the top edge, before the safe-area inset. */
    offset: 12,
    // Anchored to the top on phones: the on-screen keyboard covers the bottom
    // of the viewport, and the errors most likely to fire (upload rejected,
    // comment failed) happen while the user is typing — a bottom toast would
    // appear behind the keyboard.
    placement: 'top' as const
  }
} satisfies {
  desktop: { offset: number; placement: NotificationConfig['placement'] }
  duration: { default: number; error: number }
  mobile: { offset: number; placement: NotificationConfig['placement'] }
  mobileBreakpoint: number
}

const query = `(width < ${NOTIFICATION_SETTINGS.mobileBreakpoint}px)`

function getIsMobile(): boolean {
  // Guard for SSR/prerender, where there is no window to measure.
  if (typeof window === 'undefined' || !window.matchMedia) return false
  return window.matchMedia(query).matches
}

/** Placement half of the config, derived from the current viewport. */
export function placementFor(isMobile: boolean): Partial<NotificationConfig> {
  const { desktop, mobile } = NOTIFICATION_SETTINGS
  const side = isMobile ? mobile : desktop

  return {
    placement: side.placement,
    ...(isMobile ? { top: side.offset } : { bottom: side.offset })
  }
}

/**
 * Tracks whether the viewport is in the mobile range.
 *
 * Toasts are only ever created from user actions, so unlike layout this can
 * branch on a JS media query without risking a hydration flash.
 */
export function useIsMobileViewport(): boolean {
  const [isMobile, setIsMobile] = useState(getIsMobile)

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return
    const mql = window.matchMedia(query)
    const onChange = (e: MediaQueryListEvent) => setIsMobile(e.matches)
    mql.addEventListener('change', onChange)
    setIsMobile(mql.matches)
    return () => mql.removeEventListener('change', onChange)
  }, [])

  return isMobile
}

/**
 * Base config for `notification.useNotification`.
 *
 * Ant Design reads this once when the holder is created, so placement is not
 * taken from here — resizing the window would otherwise leave toasts anchored
 * wherever the page first loaded. `useResponsiveNotification` re-applies it per
 * call instead.
 */
export function useNotificationConfig(): NotificationConfig {
  return {
    duration: NOTIFICATION_SETTINGS.duration.default,
    maxCount: 3,
    pauseOnHover: true,
    ...placementFor(getIsMobile())
  }
}

/**
 * Per-severity overrides to spread into a notification call, e.g.
 * `notificationApi.error({ message, ...notificationOptions('error') })`.
 */
export function notificationOptions(severity: 'default' | 'error' = 'default'): Partial<ArgsProps> {
  return { duration: NOTIFICATION_SETTINGS.duration[severity] }
}

/**
 * Wraps the notification API so every call carries the placement for the
 * viewport as it is *now*, not as it was when the app mounted. Call sites stay
 * unchanged — `notificationApi.error({ message })` keeps working.
 */
export function useResponsiveNotification(api: NotificationInstance): NotificationInstance {
  const isMobile = useIsMobileViewport()

  return useMemo(() => {
    const placement = placementFor(isMobile)
    const wrap =
      (method: (args: ArgsProps) => void) =>
      (args: ArgsProps): void =>
        method({ ...placement, ...args })

    return {
      ...api,
      error: wrap(api.error),
      info: wrap(api.info),
      open: wrap(api.open),
      success: wrap(api.success),
      warning: wrap(api.warning)
    }
  }, [api, isMobile])
}
