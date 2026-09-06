import { __ } from '@common/helpers/i18nWrap'
import { Button, Typography } from 'antd'
import { LuPlus } from 'react-icons/lu'

import { useTagStoreActions } from './state/use-tag-store'
import TagCreateModal from './ui/tag-create-modal'
import TagEditModal from './ui/tag-edit-modal'
import TagsTable from './ui/tags-table'

const { Text, Title } = Typography

export default function Tags() {
  const { setIsCreateModalOpen } = useTagStoreActions()
  return (
    <div className="">
      <div className="bc-p-6 bc-px-5 bc-flex bc-justify-between bc-items-center">
        <div>
          <Title className="bc-mb-2" level={2}>
            {__('Tags')}
          </Title>
          <Text type="secondary">{__('Manage tags to organize your content')}</Text>
        </div>
        <div>
          <Button
            icon={<LuPlus />}
            onClick={() => setIsCreateModalOpen(true)}
            size="large"
            type="primary"
          >
            {__('Create Tag')}
          </Button>
        </div>
      </div>
      <TagsTable />
      <TagCreateModal />
      <TagEditModal />
    </div>
  )
}
