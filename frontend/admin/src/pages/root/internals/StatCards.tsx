import { Card, Col, Row, Statistic } from 'antd'

import { __ } from '../../../common/helpers/i18nWrap'
import { type DashboardStats } from '../data/FlowDashboardType'

export default function StatCards({ isLoading, stats }: { isLoading: boolean; stats: DashboardStats }) {
  return (
    <Row gutter={[16, 16]}>
      <Col span={6}>
        <Card className="bc-shadow-md" loading={isLoading} size="small">
          <Statistic title={__('Total Topics')} value={stats.totalTopics} />
        </Card>
      </Col>
      <Col span={6}>
        <Card className="bc-shadow-md" loading={isLoading} size="small">
          <Statistic title={__('Total Comments')} value={stats.totalComments} />
        </Card>
      </Col>
      <Col span={6}>
        <Card className="bc-shadow-md" loading={isLoading} size="small">
          <Statistic title={__('Total Members')} value={stats.totalMembers} />
        </Card>
      </Col>
      <Col span={6}>
        <Card className="bc-shadow-md" loading={isLoading} size="small">
          <Statistic title={__('Total Votes')} value={stats.totalVotes} />
        </Card>
      </Col>
    </Row>
  )
}
