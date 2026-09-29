import { __, sprintf } from '@common/helpers/i18nWrap'

import { deltaLabel } from '../shared/format'
import { type DashboardPeriod, type StageProgress as StageProgressType } from '../shared/types'
import DashboardCard from './dashboard-card'

interface StageProgressProps {
  className?: string
  hues: Map<string, string>
  period: DashboardPeriod
  stages: StageProgressType[]
}

/** How the forum's topics are spread across the stages, in the admin's order. */
export default function StageProgress({ className, hues, period, stages }: StageProgressProps) {
  const total = stages.reduce((sum, stage) => sum + stage.count, 0)

  return (
    <DashboardCard
      className={className}
      link={{ label: __('Stages'), to: 'stages' }}
      subtitle={sprintf(__('%1$d topics across your %2$d stages'), total, stages.length)}
      title={__('Roadmap progress')}
    >
      {stages.length === 0 ? (
        <p className="bc-m-0 bc-text-sm bc-text-ink-subtle">{__('No stages yet.')}</p>
      ) : (
        <>
          {/* Widths follow the counts; an empty forum shows one grey track
              instead of four zero-width segments. */}
          <div aria-hidden className="bc-flex bc-h-2 bc-gap-1 bc-overflow-hidden bc-rounded-full">
            {total === 0 ? (
              <span className="bc-flex-1 bc-rounded-full bc-bg-surface-sunken" />
            ) : (
              stages
                .filter(stage => stage.count > 0)
                .map(stage => (
                  <span
                    className="bc-rounded-full"
                    key={stage.id}
                    style={{ backgroundColor: hues.get(stage.name), flexGrow: stage.count }}
                  />
                ))
            )}
          </div>

          <ul className="bc-m-0 bc-mt-4 bc-list-none bc-divide-x-0 bc-divide-y bc-divide-solid bc-divide-line bc-p-0">
            {stages.map(stage => (
              <li className="bc-flex bc-items-center bc-gap-3 bc-py-3" key={stage.id}>
                <span
                  aria-hidden
                  className="bc-size-2 bc-shrink-0 bc-rounded-full"
                  style={{ backgroundColor: hues.get(stage.name) }}
                />
                <span className="bc-min-w-0 bc-flex-1 bc-truncate bc-text-sm bc-text-ink">{stage.name}</span>
                {stage.added > 0 && (
                  <span className="bc-shrink-0 bc-text-xs bc-text-positive">{deltaLabel(period, stage.added)}</span>
                )}
                <span className="bc-w-8 bc-shrink-0 bc-text-right bc-text-sm bc-font-semibold bc-text-ink">
                  {stage.count}
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
    </DashboardCard>
  )
}
