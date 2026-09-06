import { __, sprintf } from '@common/helpers/i18nWrap'
import {
  ignoreBadgeFailure,
  NotificationPreferencesForm,
  NotificationRow,
  NotificationsEmpty,
  NotificationsSkeleton,
  useInfiniteNotifications,
  useMarkNotificationsRead,
  useOpenNotification,
  useUnreadCount
} from '@features/notifications'
import TabNav from '@utilities/tab-nav'
import { Button, Spin, Typography } from 'antd'
import { useEffect, useRef, useState } from 'react'
import { LuCheckCheck } from 'react-icons/lu'

import config from '@/config/config'

const { Title } = Typography

const PER_PAGE = 20

/** All and Unread filter the same list; Settings replaces it. */
type Tab = 'all' | 'settings' | 'unread'

/**
 * The whole list, and the settings behind it.
 *
 * Loads as the reader scrolls rather than by page number. The sentinel below is
 * an IntersectionObserver rather than a scroll listener: the browser tells us
 * when the end of the list comes into view instead of the page recomputing
 * offsets on every frame of a flick.
 *
 * Settings sit on the same control as the filters even though they are a mode
 * rather than a filter. The alternative — a gear opening a drawer — hides the
 * one screen a member goes looking for at exactly the moment they want it:
 * while they are staring at a notification they would rather not have had.
 */
export default function NotificationsPage() {
  const [tab, setTab] = useState<Tab>('all')
  const sentinelRef = useRef<HTMLDivElement>(null)

  const { unreadCount } = useUnreadCount()
  const { hasMore, isLoadingMore, isNotificationsLoading, loadMore, notifications } =
    useInfiniteNotifications(tab === 'unread', PER_PAGE)
  const { markRead } = useMarkNotificationsRead()
  // Every hook above the guard below. The signed-out branch returns early, and
  // a hook called after it would run on some renders and not others — which
  // React treats as a different component each time.
  const handleSelect = useOpenNotification()

  useEffect(() => {
    const node = sentinelRef.current

    if (!node || !hasMore || isLoadingMore) return

    const observer = new IntersectionObserver(
      entries => {
        if (entries[0]?.isIntersecting) loadMore()
      },
      // Starts fetching a screenful early, so the next rows are usually already
      // there by the time the reader arrives and the list never visibly stalls.
      { rootMargin: '400px' }
    )

    observer.observe(node)

    return () => observer.disconnect()
  }, [hasMore, isLoadingMore, loadMore, notifications.length])

  const isEmpty = notifications.length === 0
  const isSettings = tab === 'settings'

  // A guest reaching this URL followed a link from their own email, so they are
  // told what to do rather than redirected somewhere that loses the trail.
  if (!config.IS_LOGGED_IN) {
    return (
      <div className="bc-mx-auto bc-w-full bc-max-w-3xl bc-px-4 bc-py-6">
        <NotificationsEmpty />
      </div>
    )
  }

  return (
    <div className="bc-mx-auto bc-w-full bc-max-w-3xl bc-px-4 bc-py-6">
      <div className="bc-mb-5 bc-flex bc-flex-wrap bc-items-center bc-justify-between bc-gap-3">
        <div className="bc-min-w-0">
          <Title className="bc-mb-0" level={3}>
            {__('Notifications')}
          </Title>
          {/* A running count under the heading rather than only inside the tab
              label, so the page answers "how far behind am I?" before the
              reader has to look anywhere else. */}
          <p className="bc-mb-0 bc-mt-0.5 bc-text-sm bc-text-ink-subtle">
            {unreadCount > 0 ? sprintf(__('%d unread'), unreadCount) : __('You are all caught up')}
          </p>
        </div>
        {/* Hidden on the settings tab: there is no list in view to mark, and a
            button that acts on something off-screen is a button people press by
            accident. */}
        {unreadCount > 0 && !isSettings && (
          <Button
            icon={<LuCheckCheck size={15} />}
            onClick={() => {
              markRead({ all: true }).catch(ignoreBadgeFailure)
            }}
          >
            {__('Mark all read')}
          </Button>
        )}
      </div>

      {/* TabNav rather than antd's Segmented, and not only for looks.
          Segmented's selected state is painted by a "thumb" it animates into
          place and then hands back to a CSS class on motion-end. In this app
          that motion-end never fires — the thumb element stays in the DOM and
          no item ever regains `ant-segmented-item-selected`, so after the first
          click the control shows nothing selected at all while its radio is
          correctly checked. TabNav owns its own selected state, follows the
          WAI-ARIA tabs pattern with roving arrow keys, and scrolls rather than
          wraps on a narrow screen. */}
      <div className="bc-mb-4">
        <TabNav
          activeKey={tab}
          ariaLabel={__('Notifications')}
          idPrefix="notifications"
          items={[
            { key: 'all', label: __('All') },
            { count: unreadCount || undefined, key: 'unread', label: __('Unread') },
            { key: 'settings', label: __('Settings') }
          ]}
          onChange={setTab}
        />
      </div>

      {isSettings ? (
        <div className="bc-rounded-lg bc-border bc-border-solid bc-border-line bc-bg-surface bc-p-4 sm:bc-p-5">
          <NotificationPreferencesForm />
        </div>
      ) : (
        /* Separate cards with a gap, matching the topic list every other page
           of the portal is built from — same radius, same border, same rhythm.
           The empty and loading states keep a card of their own so the column
           does not collapse to bare text. */
        <div className="bc-flex bc-flex-col bc-gap-3">
          {isNotificationsLoading && (
            <div className="bc-rounded-lg bc-border bc-border-solid bc-border-line bc-bg-surface">
              <NotificationsSkeleton rows={6} />
            </div>
          )}
          {!isNotificationsLoading && isEmpty && (
            <div className="bc-rounded-lg bc-border bc-border-solid bc-border-line bc-bg-surface">
              <NotificationsEmpty caughtUp={tab === 'unread'} />
            </div>
          )}
          {!isNotificationsLoading &&
            notifications.map(item => (
              <NotificationRow item={item} key={item.id} onSelect={handleSelect} variant="card" />
            ))}
        </div>
      )}

      {/* Watched rather than clicked. Rendered only while there is more to
          fetch, so the observer has nothing to re-trigger on at the end of the
          list — an always-present sentinel keeps firing against a query that
          has no next page. */}
      {hasMore && !isNotificationsLoading && !isSettings && (
        <div className="bc-flex bc-justify-center bc-py-6" ref={sentinelRef}>
          {isLoadingMore && <Spin size="small" />}
        </div>
      )}

      {!hasMore && !isEmpty && !isNotificationsLoading && !isSettings && (
        <p className="bc-py-6 bc-text-center bc-text-xs bc-text-ink-subtle">
          {__('That is everything.')}
        </p>
      )}
    </div>
  )
}
