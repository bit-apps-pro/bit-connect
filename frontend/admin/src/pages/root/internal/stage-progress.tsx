import { __, sprintf } from '@common/helpers/i18nWrap'

import { deltaLabel } from '../shared/format'
import { type DashboardPeriod, type StageProgress as StageProgressType } from '../shared/types'
import DashboardCard from './dashboard-card'
import StageGauge from './stage-gauge'

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
      flush
      link={{ label: __('Stages'), to: 'stages' }}
      subtitle={sprintf(__('%1$d topics across your %2$d stages'), total, stages.length)}
      title={__('Roadmap progress')}
    >
      <div className="bc-flex bc-flex-1 bc-flex-col bc-px-6 bc-pb-4 bc-pt-6">
        {stages.length === 0 ? (
          <p className="bc-m-0 bc-text-sm bc-text-ink-subtle">{__('No stages yet.')}</p>
        ) : (
          <>
            <StageGauge hues={hues} stages={stages} />

            {/* Pinned to the foot of the card, taking the room left beside the
                taller activity chart between it and the gauge. */}
            <ul className="bc-m-0 bc-mt-auto bc-list-none bc-divide-x-0 bc-divide-y bc-divide-solid bc-divide-line bc-p-0 bc-pt-6">
              {stages.map(stage => (
                <li className="bc-flex bc-items-center bc-gap-3 bc-py-3" key={stage.id}>
                  <span
                    aria-hidden
                    className="bc-size-2 bc-shrink-0 bc-rounded-full"
                    style={{ backgroundColor: hues.get(stage.name) }}
                  />
                  <span className="bc-min-w-0 bc-flex-1 bc-truncate bc-text-sm bc-text-ink">{stage.name}</span>
                  {stage.added > 0 && (
                    <span className="bc-shrink-0 bc-text-xs bc-text-positive">
                      {deltaLabel(period, stage.added)}
                    </span>
                  )}
                  <span className="bc-w-8 bc-shrink-0 bc-text-right bc-text-sm bc-font-semibold bc-tabular-nums bc-text-ink">
                    {stage.count}
                  </span>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </DashboardCard>
  )
}
