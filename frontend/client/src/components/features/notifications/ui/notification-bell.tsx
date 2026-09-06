import { __ } from '@common/helpers/i18nWrap'
import { Badge, Button, Dropdown, Grid } from 'antd'
import { useEffect, useState } from 'react'
import { LuBell } from 'react-icons/lu'
import { useNavigate } from 'react-router'

import { useMarkNotificationsRead, useNotifications, useUnreadCount } from '../data/use-notifications'
import useOpenNotification, { ignoreBadgeFailure } from '../shared/use-open-notification'
import { NotificationsEmpty, NotificationsSkeleton } from './notification-placeholders'
import NotificationRow from './notification-row'

/** How many rows the dropdown shows before sending you to the full list. */
const PANEL_SIZE = 8

/**
 * The bell in the portal header.
 *
 * The panel's rows are only fetched once it is actually opened — most visits
 * never touch it, and the badge alone answers "is there anything new?" for a
 * fraction of the cost.
 *
 * **On a phone the bell is a link, not a dropdown.** A panel wide enough to read
 * is within ~30px of the whole viewport, and the bell sits in the middle of the
 * header, so neither edge can anchor it: right-aligning runs off the left of the
 * screen and left-aligning runs off the right. antd resolves that by picking one
 * and overflowing, which dragged the entire page into horizontal scroll. There
 * is no alignment that fits, so below `md` this goes straight to the full list —
 * which is a better small-screen experience than a popover with its own inner
 * scrollbar anyway, and is what the header already does elsewhere (Create
 * collapses to "New", Register is dropped entirely).
 */
export default function NotificationBell() {
  const [open, setOpen] = useState(false)
  const navigate = useNavigate()

  // Same breakpoint the header uses for its own mobile decisions. Empty during
  // SSR, which resolves to the desktop branch — harmless here, because the bell
  // only renders for a logged-in member and hydration corrects it before the
  // panel can be opened.
  const screens = Grid.useBreakpoint()
  const isMobile = !screens.md

  const { unreadCount } = useUnreadCount()
  const { isNotificationsFetching, notifications } = useNotifications(
    { per_page: PANEL_SIZE },
    open && !isMobile
  )
  const { markRead } = useMarkNotificationsRead()
  // Closes the panel on the way out — a dropdown left open over the page it
  // just navigated to has to be dismissed by hand.
  const handleSelect = useOpenNotification(() => setOpen(false))

  // Crossing into mobile with the panel open leaves antd holding a portalled
  // dropdown that the mobile branch no longer renders a trigger for. It stayed
  // on screen, slid to a negative left offset with most of itself past the edge
  // — reachable by nothing and dismissable only by tapping the page behind it.
  // Rotating a tablet is enough to get there.
  useEffect(() => {
    if (isMobile && open) setOpen(false)
  }, [isMobile, open])

  const items = notifications?.data ?? []

  const isEmpty = items.length === 0
  const isLoading = isNotificationsFetching && isEmpty

  const panel = (
    // One resolved width rather than a fixed width plus a max-width, so antd
    // measures exactly the box it draws. This is tidiness, not the mobile fix —
    // the clamp already produced the right *width*; what did not fit was the
    // *anchor*, which is why phones skip the dropdown entirely (see the class
    // note). It still matters between md and the 22rem panel, where a narrow
    // tablet window shrinks the panel rather than letting it hang.
    <div className="bc-w-[min(23rem,calc(100vw-2rem))] bc-overflow-hidden bc-rounded-lg bc-border bc-border-solid bc-border-line bc-bg-surface bc-shadow-xl">
      <div className="bc-flex bc-items-center bc-justify-between bc-gap-2 bc-px-4 bc-pb-2 bc-pt-3">
        <span className="bc-flex bc-items-center bc-gap-2">
          <span className="bc-font-semibold bc-text-base bc-text-ink">{__('Notifications')}</span>
          {/* The count as a quiet pill rather than a second red badge. The bell
              already carries the alarm; in here the number is just a fact. */}
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
              setOpen(false)
              navigate('/notifications')
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

  const trigger = (
    <Button
      aria-label={
        unreadCount > 0 ? `${__('Notifications')} (${unreadCount} ${__('unread')})` : __('Notifications')
      }
      // A square, not a pill: the badge sits inside the button as a child, so
      // antd charges it the 15px flanks of a text button and the bell ended up
      // half again as wide as the icon it holds. Squared off, it matches the
      // menu button at the other end of the bar.
      className="bc-flex bc-h-9 bc-w-9 bc-items-center bc-justify-center bc-px-0"
      onClick={isMobile ? () => navigate('/notifications') : undefined}
      type="text"
    >
      {/* `count` is capped by antd at `overflowCount`; 99+ is plenty and a
          four-digit badge would push the header around. */}
      <Badge count={unreadCount} overflowCount={99} size="small">
        <LuBell size={18} />
      </Badge>
    </Button>
  )

  // No Dropdown wrapper at all on a phone, rather than a hidden one: antd's
  // trigger still measures and positions a dropdown it is holding, and that
  // measurement was the thing forcing the page wider than the screen.
  if (isMobile) return trigger

  return (
    <Dropdown
      dropdownRender={() => panel}
      onOpenChange={setOpen}
      open={open}
      placement="bottomRight"
      trigger={['click']}
    >
      {trigger}
    </Dropdown>
  )
}
