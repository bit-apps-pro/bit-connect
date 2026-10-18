import { __ } from '@common/helpers/i18nWrap'
import { Skeleton } from 'antd'
import { type CSSProperties } from 'react'

/** One placeholder line. `style` sizes the bar itself; the wrapper only spans the column. */
function Bar({ className, style }: { className?: string; style: CSSProperties }) {
  return <Skeleton.Input active block className={className} size="small" style={{ minWidth: 0, ...style }} />
}

/**
 * A topic card's outline while its topics load — the vote box, the title and
 * excerpt, the meta row — in the card's own frame and at about its height, so
 * the real cards land where their placeholders stood rather than shifting the
 * page. Fixed bars rather than antd's paragraph skeleton, whose spacing made
 * each placeholder ~40px taller than the card it stood for.
 */
function TopicCardSkeleton() {
  return (
    <div className="bc-flex bc-gap-3 bc-rounded-lg bc-border bc-border-solid bc-border-line bc-p-3 lg:bc-gap-4 lg:bc-p-4">
      {/* The vote box's size: 56×72, 64×88 from lg (VoteBox.module.css). */}
      <Skeleton.Node active className="!bc-h-[72px] !bc-w-14 lg:!bc-h-[88px] lg:!bc-w-16">
        <span />
      </Skeleton.Node>
      <div className="bc-flex bc-min-w-0 bc-flex-1 bc-flex-col bc-gap-2">
        <Bar style={{ height: 20, width: '60%' }} />
        {/* Titles wrap to two lines in a phone's narrow column. */}
        <Bar className="md:bc-hidden" style={{ height: 20, width: '40%' }} />
        <Bar style={{ height: 14 }} />
        <Bar style={{ height: 14, width: '75%' }} />
        <Bar style={{ height: 18, width: 180 }} />
      </div>
    </div>
  )
}

/** Several card outlines, for a list that has nothing to show yet. */
export default function TopicListSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div aria-busy="true" aria-label={__('Loading posts...')} className="bc-flex bc-flex-col bc-gap-4" role="status">
      {Array.from({ length: count }, (_, index) => (
        <TopicCardSkeleton key={index} />
      ))}
    </div>
  )
}
