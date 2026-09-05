import { Col, Row } from 'antd'

import useFetchDashboardData from './data/useFetchDashboardData'
import RecentTopics from './internals/RecentLogs'
import StatCards from './internals/StatCards'
import TopTopics from './internals/TopExecutedFlows'
import ActivityChart from './internals/TotalExecutions'

export default function Root() {
  const { isLoading, monthlyActivity, recentTopics, stats, topTopics } = useFetchDashboardData()

  return (
    <div className="bc-p-6">
      <Row gutter={[24, 24]}>
        <Col span={24}>
          <StatCards isLoading={isLoading} stats={stats} />
        </Col>

        <Col span={16}>
          <ActivityChart monthlyActivity={monthlyActivity} />
        </Col>

        <Col span={8}>
          <TopTopics topTopics={topTopics} />
        </Col>

        <Col span={24}>
          <RecentTopics recentTopics={recentTopics} />
        </Col>
      </Row>
    </div>
  )
}
