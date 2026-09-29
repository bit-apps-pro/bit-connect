import { __, sprintf } from '@common/helpers/i18nWrap'
import { theme } from 'antd'
import { BarElement, CategoryScale, Chart as ChartJS, type ChartOptions, LinearScale, Tooltip } from 'chart.js'
import { useMemo } from 'react'
import { Bar } from 'react-chartjs-2'
import { Link } from 'react-router'

import { bucketLabel } from '../shared/format'
import { type ActivityBucket, type DashboardAttention, type DashboardPeriod } from '../shared/types'
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

/**
 * What is waiting on someone, under the chart's title. Each part is only
 * mentioned when it is not zero, and reports link to their queue.
 */
function AttentionSummary({ attention }: { attention: DashboardAttention }) {
  const parts = [
    attention.unanswered > 0 && (
      <span key="unanswered">{sprintf(__('%d topics without a reply'), attention.unanswered)}</span>
    ),
    attention.reports > 0 && (
      <Link className="bc-text-negative hover:bc-underline" key="reports" to="reports">
        {sprintf(__('%d reported items to review'), attention.reports)}
      </Link>
    ),
    attention.pendingReplies > 0 && (
      <span key="held">{sprintf(__('%d replies held for approval'), attention.pendingReplies)}</span>
    )
  ].filter(Boolean)

  if (parts.length === 0) return <>{__('Nothing is waiting on you right now.')}</>

  return (
    <>
      {parts.map((part, index) => (
        <span key={index}>
          {index > 0 && ' · '}
          {part}
        </span>
      ))}
    </>
  )
}

interface ActivityChartProps {
  activity: ActivityBucket[]
  attention: DashboardAttention
  className?: string
  period: DashboardPeriod
}

export default function ActivityChart({ activity, attention, className, period }: ActivityChartProps) {
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
          label: __('Posts'),
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
          <LegendDot color={token.colorPrimary} label={__('Posts')} />
          <LegendDot color={COMMENTS_COLOR} label={__('Comments')} />
        </div>
      }
      subtitle={<AttentionSummary attention={attention} />}
      title={__('Community activity')}
    >
      <div className="bc-relative bc-h-80">
        <Bar aria-label={__('Posts and comments over time')} data={data} options={options} role="img" />
      </div>
    </DashboardCard>
  )
}
