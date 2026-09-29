import { __ } from '@common/helpers/i18nWrap'
import { Button, Typography } from 'antd'
import { LuPlus } from 'react-icons/lu'

import { useTopicTypeStoreActions } from './state/use-topic-type-store'
import TopicTypeEditModal from './ui/topic-type-edit-modal'
import TopicTypesCreateModal from './ui/topic-types-create-modal'
import TopicTypesTable from './ui/topic-types-table'

const { Title } = Typography

export default function TopicTypes() {
  const { setIsTopicTypeCreateModalOpen } = useTopicTypeStoreActions()
  return (
    <div className="bc-px-6 bc-pb-6">
      <div className="bc-flex bc-flex-wrap bc-items-center bc-justify-between bc-gap-3 bc-pb-4 bc-pt-5">
        <div className="bc-min-w-0">
          <Title className="bc-mb-0" level={3}>
            {__('Topic Types')}
          </Title>
        </div>
        <Button icon={<LuPlus />} onClick={() => setIsTopicTypeCreateModalOpen(true)} type="primary">
          {__('Add Topic Type')}
        </Button>
      </div>

      {/* The layout's ground is sunken, so the table sits on its own raised
          card, like the General screen's sections. */}
      <div className="bc-overflow-x-auto bc-rounded-lg bc-border bc-border-solid bc-border-line bc-bg-surface">
        <TopicTypesTable />
      </div>
      <TopicTypesCreateModal />
      <TopicTypeEditModal />
    </div>
  )
}
