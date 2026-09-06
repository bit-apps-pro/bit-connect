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
    <div>
      <div className="bc-py-6 bc-px-5 bc-flex bc-justify-between bc-items-center">
        <div>
          <Title className="bc-mb-2" level={2}>
            {__('Status')}
          </Title>
          <Text>{__('Manage status to organize your content')}</Text>
        </div>
        <Button
          icon={<LuPlus />}
          onClick={() => {
            setIsCreateStatusModalOpen(true)
          }}
          size="large"
          type="primary"
        >
          {__('Add Status')}
        </Button>
      </div>
      <StatusTable />
      <StatusCreateModal />
      <StatusEditModal />
    </div>
  )
}
