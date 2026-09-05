import { __ } from '@common/helpers/i18nWrap'
import slugify from '@common/helpers/slugify'
import { Alert, Form, Modal } from 'antd'

import { type ErrorResponse } from '../data/use-store-status'
import useStoreStatus from '../data/use-store-status'
import { useIsCreateStatusModalOpen, useStatusStoreActions } from '../state/use-status-store'
import StatusForm from './status-form'

const getErrorMessage = (error: ErrorResponse | null, isError: boolean) => {
  if (isError) {
    return error?.errors?.message ?? undefined
  }
  return
}

export default function StatusCreateModal() {
  const [form] = Form.useForm()
  const { setIsCreateStatusModalOpen } = useStatusStoreActions()
  const { error, isError, isStoringStatus, storeStatus } = useStoreStatus()
  const isCreateStatusModalOpen = useIsCreateStatusModalOpen()
  const errorMessage = getErrorMessage(error, isError)

  const handleOk = async () => {
    try {
      const values = await form.validateFields()
      const formattedBody = {
        description: values.description,
        meta: {
          color: values.color,
          icon_dark_id: values.icon_dark_id || 0,
          icon_dark_url: values.icon_dark_url,
          icon_id: values.icon_id || 0,
          icon_url: values.icon_url
        },
        name: values.name,
        ...(values.slug ? { slug: slugify(values.slug) } : {})
      }
      await storeStatus(formattedBody)
      form.resetFields()
      setIsCreateStatusModalOpen(false)
    } catch (error) {
      console.error('Validation failed:', error)
    }
  }

  const handleCancel = () => {
    setIsCreateStatusModalOpen(false)
  }

  return (
    <Modal
      cancelText={__('Cancel')}
      confirmLoading={isStoringStatus}
      destroyOnClose
      loading={isStoringStatus}
      okText={__('Create')}
      onCancel={handleCancel}
      onOk={handleOk}
      open={isCreateStatusModalOpen}
      title={__('Create Status')}
    >
      <StatusForm form={form} open={isCreateStatusModalOpen} />
      {errorMessage && <Alert message={errorMessage} type="error" />}
    </Modal>
  )
}
