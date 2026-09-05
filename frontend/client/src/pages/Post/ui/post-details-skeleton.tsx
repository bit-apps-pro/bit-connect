import { Skeleton } from 'antd'

import { PANEL } from './panel-styles'

/**
 * Placeholder for a topic that is still loading.
 *
 * Mirrors the real page's frame — same outer padding, same bordered card, same
 * xl-only rail — so the layout doesn't jump when the content lands. Navigating
 * between topics now clears the previous one before fetching, which would
 * otherwise drop the reader onto an empty screen mid-navigation.
 */

/** One comment row: avatar bubble beside a couple of text lines. */
function CommentSkeleton() {
  return (
    <div className="bc-flex bc-gap-3">
      <Skeleton.Avatar active size={32} />
      <div className="bc-min-w-0 bc-flex-1">
        <Skeleton active paragraph={{ rows: 2, width: ['90%', '55%'] }} title={{ width: 140 }} />
      </div>
    </div>
  )
}

export default function PostDetailsSkeleton() {
  return (
    <div
      aria-busy="true"
      className="bc-flex bc-w-full bc-max-w-full bc-flex-col bc-items-start bc-p-3 lg:bc-p-6"
    >
      {/* Stands in for the Back button, keeping the card at the same offset. */}
      <Skeleton.Button active className="bc-mb-1" size="small" style={{ width: 80 }} />

      <div className="bc-flex bc-w-full bc-max-w-full bc-items-start bc-gap-4">
        <div className="bc-min-w-0 bc-flex-1 bc-overflow-hidden bc-rounded-md bc-border bc-border-solid bc-border-line bc-px-4 bc-py-6">
          <div className="bc-flex bc-gap-4">
            {/* Vote box column — beside the title from lg, above it below that,
                matching how VoteBox is placed on the real page. */}
            <Skeleton.Node active className="bc-hidden lg:bc-block" style={{ height: 64, width: 62 }} />

            <div className="bc-min-w-0 bc-flex-1">
              <div className="bc-mb-4 bc-flex bc-gap-4 lg:bc-hidden">
                <Skeleton.Node active style={{ height: 64, width: 62 }} />
              </div>

              <Skeleton active paragraph={{ rows: 4 }} title={{ width: '70%' }} />

              <Skeleton active className="bc-mt-8" paragraph={{ rows: 0 }} title={{ width: 160 }} />

              <div className="bc-mt-6 bc-flex bc-flex-col bc-gap-6">
                <CommentSkeleton />
                <CommentSkeleton />
                <CommentSkeleton />
              </div>
            </div>
          </div>
        </div>

        {/* Rail: hidden below xl, exactly like PostSidebar. */}
        <aside className="bc-hidden bc-w-[300px] bc-shrink-0 xl:bc-block">
          <div className="bc-flex bc-flex-col bc-gap-4">
            <div className={PANEL}>
              <div className="bc-flex bc-gap-3">
                <Skeleton.Avatar active size={48} />
                <div className="bc-min-w-0 bc-flex-1">
                  <Skeleton active paragraph={{ rows: 1 }} title={{ width: '70%' }} />
                </div>
              </div>
            </div>

            <div className={PANEL}>
              <Skeleton active paragraph={{ rows: 3 }} title={{ width: 100 }} />
            </div>
          </div>
        </aside>
      </div>
    </div>
  )
}
