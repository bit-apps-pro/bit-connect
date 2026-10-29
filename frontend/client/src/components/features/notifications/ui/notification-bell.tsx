import { __ } from '@common/helpers/i18nWrap'
import { routePath } from '@utils/route-path'
import { Badge, Button, Dropdown, Grid } from 'antd'
import { lazy, Suspense, useEffect, useState } from 'react'
import { LuBell } from 'react-icons/lu'
import { useNavigate } from 'react-router'

import { useUnreadCount } from '../data/use-notifications'
import { PANEL_FRAME } from './notification-panel-frame'
import { NotificationsSkeleton } from './notification-placeholders'

// The panel loads on demand — see NotificationPanel. Hovering the bell starts
// the download, so the panel is usually there by the click.
const loadPanel = () => import('./notification-panel')
const NotificationPanel = lazy(loadPanel)

const preloadPanel = () => {
  loadPanel().catch(() => {
    // Only a head start. Opening the panel loads it again.
  })
}

/**
 * The bell in the portal header.
 *
 * The panel's rows are only fetched once it is actually opened — most visits
 * never touch it, and the badge alone answers "is there anything new?" for a
 * fraction of the cost. The panel's code is not in the first download either.
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

  // Crossing into mobile with the panel open leaves antd holding a portalled
  // dropdown that the mobile branch no longer renders a trigger for. It stayed
  // on screen, slid to a negative left offset with most of itself past the edge
  // — reachable by nothing and dismissable only by tapping the page behind it.
  // Rotating a tablet is enough to get there.
  useEffect(() => {
    if (isMobile && open) setOpen(false)
  }, [isMobile, open])

  // Until the panel's code arrives, its frame with the same skeleton the
  // panel shows while its rows load — one loading state, not two.
  const panel = (
    <Suspense
      fallback={
        <div className={PANEL_FRAME}>
          <NotificationsSkeleton rows={4} />
        </div>
      }
    >
      <NotificationPanel isOpen={open} onClose={() => setOpen(false)} unreadCount={unreadCount} />
    </Suspense>
  )

  const trigger = (
    <Button
      aria-label={
        unreadCount > 0 ? `${__('Notifications')} (${unreadCount} ${__('unread')})` : __('Notifications')
      }
      // A square, not a pill: the badge sits inside the button as a child, so
      // antd charges it the 15px flanks of a text button and the bell ended up
      // half again as wide as the icon it holds. Squared off, it matches the
      // menu button at the other end of the bar. From md the right margin
      // clears the badge, which hangs 6px past the button's edge; on a phone
      // the bell sits close to the account menu instead, and the badge hangs
      // into that button's own padding.
      className="touch-target bc-flex bc-h-9 bc-w-9 bc-items-center bc-justify-center bc-px-0 md:bc-mr-2"
      onClick={isMobile ? () => navigate(routePath('/notifications')) : undefined}
      onFocus={isMobile ? undefined : preloadPanel}
      onMouseEnter={isMobile ? undefined : preloadPanel}
      type="text"
    >
      {/* `count` is capped by antd at `overflowCount`; 99+ is plenty and a
          four-digit badge would push the header around. Shifted right, since
          antd centres it on the icon's corner and two digits covered half the
          bell.

          Brand blue, not antd's error red: an unread count is news, not a
          fault, and red in the header read as something having gone wrong.
          A fixed square rounded off, so one digit and two draw the same
          circle instead of the count stretching into a pill. "99+" is the one
          label too wide for that circle at 10px, so it alone steps down. */}
      {/* The count is pinned over the icon's corner explicitly: left in flow it
          sat beside the bell, doubling the badge to 36px, pushing the bell to
          the button's left edge and hanging the count in the gap after it. */}
      <Badge
        className="bc-relative bc-flex"
        classNames={{
          indicator: [
            'bc-absolute bc-right-0 bc-top-0 bc-h-[18px] bc-w-[18px] bc-min-w-[18px] bc-rounded-full bc-bg-primary bc-p-0',
            'bc-font-semibold bc-leading-[18px]',
            unreadCount > 99 ? 'bc-text-[8.5px] bc-tracking-tighter' : 'bc-text-[10px]'
          ].join(' ')
        }}
        count={unreadCount}
        offset={[6, 0]}
        overflowCount={99}
        size="small"
      >
        <LuBell size={22} />
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
