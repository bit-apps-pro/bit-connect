import { __, sprintf } from '@common/helpers/i18nWrap'
import { Progress, theme } from 'antd'

import { shortDuration } from '../shared/format'
import { type DashboardPeriod, type DashboardResponse } from '../shared/types'
import DashboardCard from './dashboard-card'

/** One whole string per period, as the other period labels are. */
function startedLabel(period: DashboardPeriod): string {
  if (period === '7d') return __('Posts created this week')
  if (period === '12m') return __('Posts created this year')
  return __('Posts created this month')
}

interface ResponseTimeProps {
  className?: string
  period: DashboardPeriod
  response: DashboardResponse
}

/**
 * How long a new topic waits for someone else to comment on it — the number
 * that says whether asking here is worth it. Only topics started during the
 * period are measured, so a backlog of old ones does not drag it.
 */
export default function ResponseTime({ className, period, response }: ResponseTimeProps) {
  const { token } = theme.useToken()
  const promptShare =
    response.promptEligible > 0 ? Math.round((response.answeredPromptly / response.promptEligible) * 100) : undefined

  return (
    <DashboardCard
      className={className}
      subtitle={startedLabel(period)}
      title={__('Response time')}
    >
      {response.topics === 0 ? (
        <p className="bc-m-0 bc-py-6 bc-text-center bc-text-sm bc-text-ink-subtle">
          {__('Nobody created a post in this period.')}
        </p>
      ) : (
        <div className="bc-flex bc-flex-col bc-gap-5">
          <div>
            <div className="bc-text-sm bc-text-ink-muted">{__('Median time to first comment')}</div>
            <div className="bc-mt-1 bc-text-3xl bc-font-semibold bc-leading-tight bc-text-ink">
              {response.medianSeconds === null ? '-' : shortDuration(response.medianSeconds)}
            </div>
            <div className="bc-mt-1 bc-text-xs bc-text-ink-subtle">
              {sprintf(__('%1$d of %2$d have a comment from someone else'), response.answered, response.topics)}
            </div>
          </div>

          <div>
            <div className="bc-flex bc-items-baseline bc-justify-between bc-gap-3">
              <span className="bc-text-sm bc-text-ink-muted">{__('Commented on within a day')}</span>
              <span className="bc-text-sm bc-font-semibold bc-tabular-nums bc-text-ink">
                {promptShare === undefined ? '-' : `${promptShare}%`}
              </span>
            </div>
            <Progress
              aria-label={__('Commented on within a day')}
              percent={promptShare ?? 0}
              showInfo={false}
              strokeColor={token.colorPrimary}
            />
            <div className="bc-text-xs bc-text-ink-subtle">
              {promptShare === undefined
                ? __('This counts each post when it is one day old.')
                : sprintf(__('%1$d of %2$d posts at least a day old'), response.answeredPromptly, response.promptEligible)}
            </div>
          </div>
        </div>
      )}
    </DashboardCard>
  )
}
