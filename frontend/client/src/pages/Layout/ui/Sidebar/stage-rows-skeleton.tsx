import { useStagesStore } from '@pages/Layout/data/use-stages'
import { Skeleton } from 'antd'
import { type ReactNode } from 'react'

/**
 * Row-sized placeholders while the stages load, so the links fill in where
 * they will stand rather than pushing the rest of the sidebar down when they
 * arrive. Renders nothing once they have.
 */
export default function StageRowsSkeleton(): ReactNode {
  const isLoading = useStagesStore(state => state.isLoading)
  const hasStages = useStagesStore(state => state.stages.length > 0)

  if (!isLoading || hasStages) return

  return Array.from({ length: 6 }, (_, index) => (
    <div aria-hidden className="bc-flex bc-h-11 bc-items-center bc-gap-3 bc-px-2.5" key={index}>
      <Skeleton.Avatar active shape="square" size={18} />
      {/* Uneven widths, as stage names are. */}
      <Skeleton.Input active size="small" style={{ height: 14, minWidth: 0, width: 96 + ((index * 37) % 50) }} />
    </div>
  ))
}
