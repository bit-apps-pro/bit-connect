import { Card, Space, Tag, Typography } from 'antd'

import { __ } from '../../../common/helpers/i18nWrap'
import { type TopTopicType } from '../data/FlowDashboardType'

export default function TopTopics({ topTopics }: { topTopics: TopTopicType[] }) {
  return (
    <Card className="bc-shadow-md" loading={false} size="small" title={__('Top Topics')}>
      {topTopics.length === 0 ? (
        <Typography.Text type="secondary">{__('No topics yet.')}</Typography.Text>
      ) : (
        topTopics.map(topic => (
          <Space
            css={{ justifyContent: 'space-between', marginBottom: 8, width: '100%' }}
            key={topic.id}
          >
            <Typography.Text ellipsis style={{ maxWidth: 160 }}>
              {topic.title}
            </Typography.Text>
            <Tag color="blue">{topic.vote_count}</Tag>
          </Space>
        ))
      )}
    </Card>
  )
}
