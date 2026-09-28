import { Skeleton } from 'antd'

/** One card's outline, so the page keeps its shape while it loads. */
function CardSkeleton({ rows }: { rows: number }) {
  return (
    <div className="bc-rounded-lg bc-border bc-border-solid bc-border-line bc-bg-surface bc-px-6 bc-py-5">
      <Skeleton active paragraph={{ rows }} title={{ width: '30%' }} />
    </div>
  )
}

/**
 * The page's layout without its values: the header, the master switch and the
 * cards below it, drawn in place so nothing jumps when the settings arrive.
 */
export default function PageSkeleton() {
  return (
    <div aria-busy className="bc-p-6">
      <div className="bc-mb-5">
        <Skeleton active paragraph={{ rows: 1, width: '45%' }} title={{ width: 180 }} />
      </div>
      <div className="bc-flex bc-flex-col bc-gap-5">
        <div className="bc-max-w-xl">
          <CardSkeleton rows={1} />
        </div>
        <CardSkeleton rows={8} />
        <CardSkeleton rows={4} />
        <CardSkeleton rows={4} />
      </div>
    </div>
  )
}
