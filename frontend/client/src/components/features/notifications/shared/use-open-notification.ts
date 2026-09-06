import { useNavigate } from 'react-router'

import { type NotificationItem, useMarkNotificationsRead } from '../data/use-notifications'

/**
 * Failing to clear a badge is not worth interrupting someone who has already
 * been taken to the thing they clicked. Named rather than an empty arrow so the
 * silence is a decision on the page instead of something a reader has to infer.
 */
const ignoreBadgeFailure = (): void => undefined

/**
 * Opening a notification: mark it seen, then go where it points.
 *
 * Shared by the bell and the full list because they must not drift. The two
 * screens show the same rows, and a click behaving differently depending on
 * which one it came from is the kind of difference nobody reports and everybody
 * notices.
 */
export default function useOpenNotification(onOpen?: () => void) {
  const navigate = useNavigate()
  const { markRead } = useMarkNotificationsRead()

  return (item: NotificationItem) => {
    onOpen?.()

    // Marked before navigating, not after. Opening a notification is the
    // clearest possible statement that it has been seen, and leaving it unread
    // means the badge still counts something the reader is looking at.
    if (!item.read) {
      markRead({ ids: [item.id] }).catch(ignoreBadgeFailure)
    }

    const url = item.context.url

    // A row whose target is gone is still worth reading — it says what happened
    // — but there is nowhere to send anyone. The row already says so.
    if (!url || !item.target.exists) return

    try {
      const parsed = new URL(url, window.location.origin)

      // Same-origin links belong to the SPA, so route internally and keep the
      // page state. Anything else — a link a future channel or an extension put
      // there — leaves the app properly rather than being fed to the router,
      // which would turn it into a 404 inside the portal.
      if (parsed.origin === window.location.origin) {
        navigate(`${parsed.pathname}${parsed.search}${parsed.hash}`)

        return
      }

      window.location.href = url
    } catch {
      // Not parseable as a URL at all. Hand it to the browser, which has a
      // better answer for a malformed href than the router does.
      window.location.href = url
    }
  }
}

export { ignoreBadgeFailure }
