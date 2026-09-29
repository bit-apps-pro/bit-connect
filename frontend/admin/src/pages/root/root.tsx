import { __ } from '@common/helpers/i18nWrap'
import { Alert, Button, ConfigProvider, Segmented, theme, Typography } from 'antd'
import { useMemo, useState } from 'react'
import { LuArrowUpRight } from 'react-icons/lu'

import useDashboard from './data/use-dashboard'
import ActivityChart from './internal/activity-chart'
import MostRequested from './internal/most-requested'
import PageSkeleton from './internal/page-skeleton'
import RecentActivity from './internal/recent-activity'
import RecentTopics from './internal/recent-topics'
import StageProgress from './internal/stage-progress'
import StatCards from './internal/stat-cards'
import { PERIOD_OPTIONS, stageHues } from './shared/format'
import { type DashboardPeriod } from './shared/types'

const { Text, Title } = Typography

export default function Root() {
  const [period, setPeriod] = useState<DashboardPeriod>('30d')
  const { dashboard, isDashboardError, isDashboardPending, isDashboardStale, refetchDashboard } =
    useDashboard(period)
  const { token } = theme.useToken()

  const hues = useMemo(() => stageHues(dashboard?.stages ?? []), [dashboard?.stages])
  // Numbers and the columns that name the period follow the data, not the
  // switch: while the next period loads, the dimmed cards still describe the
  // one they are showing.
  const shownPeriod = dashboard?.period ?? period

  return (
    <div className="bc-p-6">
      <div className="bc-mb-5 bc-flex bc-flex-wrap bc-items-start bc-justify-between bc-gap-4">
        <div>
          <Title className="bc-mb-1" level={3}>
            {__('Dashboard')}
          </Title>
          <Text type="secondary">{__('What is happening in your community, and what needs you today.')}</Text>
        </div>

        <div className="bc-flex bc-flex-wrap bc-items-center bc-gap-3">
          {/* The filled pill the other screens use for switching views, at a
              header's size. */}
          <ConfigProvider
            theme={{
              components: {
                Segmented: {
                  itemHoverBg: token.colorFillTertiary,
                  itemSelectedBg: token.colorPrimary,
                  itemSelectedColor: token.colorTextLightSolid,
                  trackBg: 'var(--bc-surface)',
                  trackPadding: 4
                }
              },
              token: { borderRadius: 10, borderRadiusSM: 8, controlHeight: 36, controlPaddingHorizontal: 14 }
            }}
          >
            <Segmented
              className="bc-max-w-full bc-overflow-x-auto bc-border bc-border-solid bc-border-line [&_.ant-segmented-item-selected]:bc-font-semibold"
              onChange={value => setPeriod(value)}
              options={PERIOD_OPTIONS}
              value={period}
            />
          </ConfigProvider>

          {dashboard?.portalUrl && (
            <Button
              className="bc-h-11 bc-font-medium"
              href={dashboard.portalUrl}
              icon={<LuArrowUpRight aria-hidden />}
              iconPosition="end"
              target="_blank"
            >
              {__('Visit portal')}
            </Button>
          )}
        </div>
      </div>

      {isDashboardError && !dashboard && (
        <Alert
          action={
            <Button onClick={() => refetchDashboard()} size="small">
              {__('Try again')}
            </Button>
          }
          className="bc-mb-5"
          description={__('The dashboard could not be loaded.')}
          message={__('Something went wrong')}
          showIcon
          type="error"
        />
      )}

      {isDashboardPending && <PageSkeleton />}

      {dashboard && (
        <div
          className={`bc-flex bc-flex-col bc-gap-5 bc-transition-opacity ${
            isDashboardStale ? 'bc-pointer-events-none bc-opacity-50' : ''
          }`}
        >
          <StatCards period={shownPeriod} stats={dashboard.stats} topicTypes={dashboard.topicTypes} />

          {/* Recent activity spans the last two rows, filling the column beside
              both tables instead of leaving a gap under Roadmap progress. */}
          <div className="bc-grid bc-gap-5 xl:bc-grid-cols-3">
            <ActivityChart
              activity={dashboard.activity}
              attention={dashboard.attention}
              className="xl:bc-col-span-2"
              period={shownPeriod}
            />
            <StageProgress hues={hues} period={shownPeriod} stages={dashboard.stages} />
            <MostRequested
              className="xl:bc-col-span-2"
              hues={hues}
              period={shownPeriod}
              portalUrl={dashboard.portalUrl}
              topics={dashboard.mostRequested}
            />
            <RecentActivity className="xl:bc-row-span-2" entries={dashboard.recentActivity} />
            <RecentTopics
              className="xl:bc-col-span-2"
              hues={hues}
              portalUrl={dashboard.portalUrl}
              topics={dashboard.recentTopics}
            />
          </div>
        </div>
      )}
    </div>
  )
}
