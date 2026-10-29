import { __ } from '@common/helpers/i18nWrap'
import { routePath } from '@utils/route-path'
import { Button } from 'antd'
import { useNavigate } from 'react-router'

import { useMarkNotificationsRead, useNotifications } from '../data/use-notifications'
import useOpenNotification, { ignoreBadgeFailure } from '../shared/use-open-notification'
import { PANEL_FRAME } from './notification-panel-frame'
import { NotificationsEmpty, NotificationsSkeleton } from './notification-placeholders'
import NotificationRow from './notification-row'

/** How many rows the dropdown shows before sending you to the full list. */
const PANEL_SIZE = 8

interface NotificationPanelProps {
  /**
   * Whether the dropdown is open. antd keeps a dropdown mounted after it
   * closes, so this, not mounting, is what limits the fetch to open panels.
   */
  isOpen: boolean
  /** Close the dropdown — on the way to a notification or the full list. */
  onClose: () => void
  unreadCount: number
}

/**
 * What the bell opens: the latest notifications and a way to the full list.
 *
 * Its own module, loaded the first time the bell is hovered or opened, so the
 * rows and their query are not in the first download for every visitor. The
 * rows themselves are only fetched while the panel is open — most visits never
 * touch it, and the badge alone answers "is there anything new?".
 */
export default function NotificationPanel({ isOpen, onClose, unreadCount }: NotificationPanelProps) {
  const navigate = useNavigate()
  const { isNotificationsFetching, notifications } = useNotifications({ per_page: PANEL_SIZE }, isOpen)
  const { markRead } = useMarkNotificationsRead()
  // Closes the panel on the way out — a dropdown left open over the page it
  // just navigated to has to be dismissed by hand.
  const handleSelect = useOpenNotification(onClose)

  const items = notifications?.data ?? []

  const isEmpty = items.length === 0
  const isLoading = isNotificationsFetching && isEmpty

  return (
    <div className={PANEL_FRAME}>
      <div className="bc-flex bc-items-center bc-justify-between bc-gap-2 bc-px-4 bc-pb-2 bc-pt-3">
        <span className="bc-flex bc-items-center bc-gap-2">
          <span className="bc-font-semibold bc-text-base bc-text-ink">{__('Notifications')}</span>
          {/* The count as a quiet pill rather than a second solid badge. The
              bell already carries the signal; in here the number is just a
              fact. */}
          {unreadCount > 0 && (
            <span className="bc-rounded-full bc-bg-info-soft bc-px-2 bc-py-0.5 bc-text-xs bc-font-medium bc-text-info">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </span>
        {unreadCount > 0 && (
          <Button
            className="bc-px-0"
            onClick={() => {
              markRead({ all: true }).catch(ignoreBadgeFailure)
            }}
            size="small"
            type="link"
          >
            {__('Mark all read')}
          </Button>
        )}
      </div>

      {/* Capped against the viewport as well as in absolute terms: 24rem is
          taller than a landscape phone, where a fixed cap would run the list
          off the bottom of the screen with its own scrollbar unreachable. */}
      <div className="bc-max-h-[min(24rem,60vh)] bc-overflow-y-auto [&>button+button]:bc-border-t [&>button+button]:bc-border-solid [&>button+button]:bc-border-t-line">
        {isLoading && <NotificationsSkeleton rows={4} />}
        {!isLoading && isEmpty && <NotificationsEmpty compact />}
        {!isLoading &&
          items.map(item => <NotificationRow item={item} key={item.id} onSelect={handleSelect} />)}
      </div>

      {items.length > 0 && (
        <div className="bc-border-0 bc-border-t bc-border-solid bc-border-line bc-p-2">
          <Button
            block
            onClick={() => {
              onClose()
              navigate(routePath('/notifications'))
            }}
            size="small"
            type="text"
          >
            {__('See all notifications')}
          </Button>
        </div>
      )}
    </div>
  )
}
