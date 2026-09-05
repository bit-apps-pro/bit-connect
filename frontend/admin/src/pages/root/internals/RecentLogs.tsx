import { Card, Table, type TableProps, Typography } from 'antd'

import { __ } from '../../../common/helpers/i18nWrap'
import { type RecentTopicType } from '../data/FlowDashboardType'

const columns: TableProps<RecentTopicType>['columns'] = [
  {
    dataIndex: 'title',
    key: 'title',
    render: (title: string) => <Typography.Text>{title}</Typography.Text>,
    title: __('Topic')
  },
  {
    dataIndex: 'author',
    key: 'author',
    title: __('Author')
  },
  {
    dataIndex: 'vote_count',
    key: 'vote_count',
    title: __('Votes')
  },
  {
    dataIndex: 'created_at',
    key: 'created_at',
    render: (date: string) => new Date(date).toLocaleDateString(),
    title: __('Date')
  }
]

export default function RecentTopics({ recentTopics }: { recentTopics: RecentTopicType[] }) {
  return (
    <Card className="bc-shadow-md" size="small" title={__('Recent Topics')}>
      <Table<RecentTopicType>
        columns={columns}
        dataSource={recentTopics}
        pagination={false}
        rowKey="id"
        size="small"
      />
    </Card>
  )
}
