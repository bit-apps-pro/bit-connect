import { __ } from '@common/helpers/i18nWrap'
import { Alert, Form, Modal } from 'antd'

import { type ErrorResponse } from '../data/use-store-tag'
import useStoreTag from '../data/use-store-tag'
import { useIsCreateModalOpenSelect, useTagStoreActions } from '../state/use-tag-store'
import TagForm from './tag-form'

const getErrorMessage = (error: ErrorResponse | null, isError: boolean) => {
  if (isError) {
    return error?.errors?.message ?? undefined
  }
  return
}

export default function TagCreateModal() {
  const [form] = Form.useForm()
  const isCreateModalOpen = useIsCreateModalOpenSelect()
  const { setIsCreateModalOpen } = useTagStoreActions()
  const { error, isError, isStoringTag, storeTag } = useStoreTag()
  const errorMessage = getErrorMessage(error, isError)

  const handleCancel = () => {
    setIsCreateModalOpen(false)
    form.resetFields()
  }
  const handleOk = async () => {
    try {
      const values = await form.validateFields()
      await storeTag(values)
      form.resetFields()
      setIsCreateModalOpen(false)
    } catch (error) {
      console.error('Failed to create tag:', error)
    }
  }
  return (
    <Modal
      cancelText={__('Cancel')}
      confirmLoading={isStoringTag}
      okText={__('Create Tag')}
      onCancel={handleCancel}
      onOk={handleOk}
      open={isCreateModalOpen}
      title={__('Create Tag')}
    >
      <TagForm form={form} open={isCreateModalOpen} />
      {errorMessage && <Alert message={errorMessage} type="error" />}
    </Modal>
  )
}
