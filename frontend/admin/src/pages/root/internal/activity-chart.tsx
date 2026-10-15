import { __ } from '@common/helpers/i18nWrap'
import { theme } from 'antd'
import { BarElement, CategoryScale, Chart as ChartJS, type ChartOptions, LinearScale, Tooltip } from 'chart.js'
import { useMemo } from 'react'
import { Bar } from 'react-chartjs-2'

import { bucketLabel } from '../shared/format'
import { type ActivityBucket, type DashboardPeriod } from '../shared/types'
import DashboardCard from './dashboard-card'

ChartJS.register(BarElement, CategoryScale, LinearScale, Tooltip)

/** Replies sit under topics in a lighter blue, so the brand blue on top is the new work. */
const COMMENTS_COLOR = '#1f9bff'

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span className="bc-inline-flex bc-items-center bc-gap-2 bc-text-sm bc-text-ink">
      <span aria-hidden className="bc-size-2.5 bc-rounded-full" style={{ backgroundColor: color }} />
      {label}
    </span>
  )
}

interface ActivityChartProps {
  activity: ActivityBucket[]
  className?: string
  period: DashboardPeriod
}

export default function ActivityChart({ activity, className, period }: ActivityChartProps) {
  const { token } = theme.useToken()

  const data = useMemo(
    () => ({
      datasets: [
        {
          backgroundColor: COMMENTS_COLOR,
          borderRadius: 0,
          data: activity.map(bucket => bucket.comments),
          label: __('Comments'),
          maxBarThickness: 48
        },
        {
          backgroundColor: token.colorPrimary,
          // Only the top of the stack is rounded; `borderSkipped: false` stops
          // Chart.js squaring the corners it assumes touch the axis.
          borderRadius: { bottomLeft: 0, bottomRight: 0, topLeft: 6, topRight: 6 },
          borderSkipped: false as const,
          data: activity.map(bucket => bucket.topics),
          label: __('Topics'),
          maxBarThickness: 48
        }
      ],
      labels: activity.map(bucket => bucketLabel(bucket.date, period))
    }),
    [activity, period, token.colorPrimary]
  )

  const options = useMemo<ChartOptions<'bar'>>(
    () => ({
      interaction: { intersect: false, mode: 'index' },
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        // Listed top of the stack first, the order they are drawn in.
        tooltip: { itemSort: (a, b) => b.datasetIndex - a.datasetIndex }
      },
      responsive: true,
      scales: {
        x: {
          border: { display: false },
          grid: { display: false },
          stacked: true,
          ticks: { autoSkip: true, color: token.colorTextSecondary, maxRotation: 0, maxTicksLimit: 12 }
        },
        y: {
          beginAtZero: true,
          border: { display: false },
          grid: { color: token.colorBorderSecondary },
          stacked: true,
          ticks: { color: token.colorTextSecondary, maxTicksLimit: 6, precision: 0 }
        }
      }
    }),
    [token.colorBorderSecondary, token.colorTextSecondary]
  )

  return (
    <DashboardCard
      className={className}
      extra={
        <div className="bc-flex bc-items-center bc-gap-5">
          <LegendDot color={token.colorPrimary} label={__('Topics')} />
          <LegendDot color={COMMENTS_COLOR} label={__('Comments')} />
        </div>
      }
      subtitle={__('Topics and comments published')}
      title={__('Community activity')}
    >
      {/* Grows to the height of the row, which Stage progress usually sets.
          The canvas sits out of flow so its own size cannot feed back into the
          box Chart.js measures, which would grow it on every resize. */}
      <div className="bc-relative bc-min-h-80 bc-flex-1">
        <div className="bc-absolute bc-inset-0">
          <Bar aria-label={__('Topics and comments over time')} data={data} options={options} role="img" />
        </div>
      </div>
    </DashboardCard>
  )
}
