import { __ } from '@common/helpers/i18nWrap'
import { Button, Typography } from 'antd'
import { LuPlus } from 'react-icons/lu'

import { useTopicTypeStoreActions } from './state/use-topic-type-store'
import TopicTypeEditModal from './ui/topic-type-edit-modal'
import TopicTypesCreateModal from './ui/topic-types-create-modal'
import TopicTypesTable from './ui/topic-types-table'

export default function TopicTypes() {
  const { setIsTopicTypeCreateModalOpen } = useTopicTypeStoreActions()
  return (
    <div>
      <div>
        <div className="bc-py-6 bc-px-5 bc-flex bc-justify-between bc-items-center">
          <div>
            <Typography.Title level={2}>{__('Topic Types')}</Typography.Title>
            <Typography.Text>{__('Manage your topic types here')}</Typography.Text>
          </div>
          <Button
            icon={<LuPlus />}
            onClick={() => setIsTopicTypeCreateModalOpen(true)}
            size="large"
            type="primary"
          >
            {__('Add Topic Type')}
          </Button>
        </div>
      </div>
      <TopicTypesTable />
      <TopicTypesCreateModal />
      <TopicTypeEditModal />
    </div>
  )
}
