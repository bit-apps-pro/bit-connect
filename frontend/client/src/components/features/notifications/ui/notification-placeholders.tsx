import { cn } from '@common/helpers/globalHelpers'
import { __ } from '@common/helpers/i18nWrap'
import { LuBellOff, LuCheck } from 'react-icons/lu'

/**
 * What the list shows when it has nothing to show.
 *
 * A spinner and a stock "No data" both say the same thing — that something is
 * missing — where an empty notification list is usually good news. The caught-up
 * state gets its own icon and wording for that reason: a member with no unread
 * replies has not hit an empty screen, they are finished.
 */

interface EmptyProps {
  /** True for the Unread tab, where empty means done rather than never. */
  caughtUp?: boolean
  compact?: boolean
}

export function NotificationsEmpty({ caughtUp = false, compact = false }: EmptyProps) {
  const Icon = caughtUp ? LuCheck : LuBellOff

  return (
    <div
      className={cn([
        'bc-flex bc-flex-col bc-items-center bc-justify-center bc-px-6 bc-text-center',
        compact ? 'bc-py-10' : 'bc-py-16'
      ])}
    >
      <span
        className={cn([
          'bc-mb-3 bc-flex bc-h-11 bc-w-11 bc-items-center bc-justify-center bc-rounded-full',
          caughtUp ? 'bc-bg-positive-soft bc-text-positive' : 'bc-bg-surface-sunken bc-text-ink-subtle'
        ])}
      >
        <Icon size={20} />
      </span>
      <p className="bc-mb-1 bc-font-medium bc-text-ink bc-text-sm">
        {caughtUp ? __('You are all caught up') : __('Nothing yet')}
      </p>
      <p className="bc-m-0 bc-max-w-[16rem] bc-text-xs bc-text-ink-subtle">
        {caughtUp
          ? __('New replies and mentions will appear here.')
          : __('Replies, mentions and moderation decisions will show up here.')}
      </p>
    </div>
  )
}

/**
 * Rows in outline while the real ones load.
 *
 * A skeleton in the shape of the answer rather than a spinner: the list keeps
 * its height, nothing jumps when the rows arrive, and the reader can already
 * see they are waiting for a list and not a page.
 */
export function NotificationsSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div aria-hidden className="bc-animate-pulse">
      {Array.from({ length: rows }, (_, index) => (
        <div className="bc-flex bc-items-start bc-gap-3 bc-py-3 bc-pe-4 bc-ps-5" key={index}>
          <span className="bc-h-9 bc-w-9 bc-shrink-0 bc-rounded-full bc-bg-surface-sunken" />
          <span className="bc-min-w-0 bc-flex-1">
            <span className="bc-block bc-h-3 bc-w-3/4 bc-rounded bc-bg-surface-sunken" />
            <span className="bc-mt-2 bc-block bc-h-2.5 bc-w-1/2 bc-rounded bc-bg-surface-sunken" />
          </span>
        </div>
      ))}
    </div>
  )
}
