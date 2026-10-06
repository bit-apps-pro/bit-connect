import { __ } from '@common/helpers/i18nWrap'
import { Button, Typography } from 'antd'
import { LuPlus } from 'react-icons/lu'

import { useTagStoreActions } from './state/use-tag-store'
import TagCreateModal from './ui/tag-create-modal'
import TagEditModal from './ui/tag-edit-modal'
import TagsTable from './ui/tags-table'

const { Title } = Typography

export default function Tags() {
  const { setIsCreateModalOpen } = useTagStoreActions()
  return (
    <div className="bc-px-6 bc-pb-6">
      <div className="bc-flex bc-flex-wrap bc-items-center bc-justify-between bc-gap-3 bc-pb-4 bc-pt-5">
        <div className="bc-min-w-0">
          <Title className="bc-mb-0" level={3}>
            {__('Tags')}
          </Title>
        </div>
        <Button icon={<LuPlus />} onClick={() => setIsCreateModalOpen(true)} type="primary">
          {__('Create Tag')}
        </Button>
      </div>

      {/* The layout's ground is sunken, so the table sits on its own raised
          card, like the General screen's sections. */}
      <div className="bc-overflow-x-auto bc-rounded-lg bc-border bc-border-solid bc-border-line bc-bg-surface">
        <TagsTable />
      </div>
      <TagCreateModal />
      <TagEditModal />
    </div>
  )
}
