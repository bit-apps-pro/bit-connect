import { __ } from '@common/helpers/i18nWrap'
import { Button, Typography } from 'antd'
import { LuPlus } from 'react-icons/lu'

import { useStatusStoreActions } from './state/use-status-store'
import StatusCreateModal from './ui/status-create-modal'
import StatusEditModal from './ui/status-edit-modal'
import StatusTable from './ui/status-table'

const { Text, Title } = Typography
export default function Status() {
  const { setIsCreateStatusModalOpen } = useStatusStoreActions()
  return (
    <div className="bc-px-6 bc-pb-6">
      <div className="bc-flex bc-flex-wrap bc-items-center bc-justify-between bc-gap-3 bc-pb-4 bc-pt-5">
        <div className="bc-min-w-0">
          <Title className="bc-mb-0.5" level={3}>
            {__('Status')}
          </Title>
          <Text className="bc-text-xs" type="secondary">
            {__('Where each topic stands, shown as a badge beside it. Drag to reorder.')}
          </Text>
        </div>
        <Button icon={<LuPlus />} onClick={() => setIsCreateStatusModalOpen(true)} type="primary">
          {__('Add Status')}
        </Button>
      </div>

      {/* The layout's ground is sunken, so the table sits on its own raised
          card, like the General screen's sections. */}
      <div className="bc-overflow-hidden bc-rounded-lg bc-border bc-border-solid bc-border-line bc-bg-surface">
        <StatusTable />
      </div>
      <StatusCreateModal />
      <StatusEditModal />
    </div>
  )
}
