import { Skeleton } from 'antd'

function CardSkeleton({ className, rows }: { className?: string; rows: number }) {
  return (
    <div
      className={`bc-rounded-lg bc-border bc-border-solid bc-border-line bc-bg-surface bc-px-6 bc-py-5 ${className ?? ''}`}
    >
      <Skeleton active paragraph={{ rows }} title={{ width: '35%' }} />
    </div>
  )
}

/** The dashboard's grid without its numbers, so nothing jumps when they arrive. */
export default function PageSkeleton() {
  return (
    <div aria-busy className="bc-flex bc-flex-col bc-gap-5">
      <div className="bc-grid bc-gap-5 sm:bc-grid-cols-2 xl:bc-grid-cols-4">
        {[0, 1, 2, 3].map(index => (
          <CardSkeleton key={index} rows={2} />
        ))}
      </div>
      <div className="bc-grid bc-gap-5 xl:bc-grid-cols-3">
        <CardSkeleton className="xl:bc-col-span-2" rows={9} />
        <CardSkeleton rows={9} />
        <CardSkeleton className="xl:bc-col-span-2" rows={6} />
        <CardSkeleton rows={6} />
      </div>
    </div>
  )
}
