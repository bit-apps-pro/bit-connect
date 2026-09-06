import { __ } from '@common/helpers/i18nWrap'
import slugify from '@common/helpers/slugify'
import { Alert, Form, Modal } from 'antd'

import useStoreTopicType from '../data/use-store-topic-type'
import { type ErrorResponse } from '../data/use-store-topic-type'
import { useIsTopicTypeCreateModalOpen, useTopicTypeStoreActions } from '../state/use-topic-type-store'
import ProductForm from './topic-type-form'

const getErrorMessage = (error: ErrorResponse | null, isError: boolean) => {
  if (isError) {
    return error?.errors?.message ?? undefined
  }
  return
}

export default function TopicTypesCreateModal() {
  const isTopicTypeModalOpen = useIsTopicTypeCreateModalOpen()
  const { setIsTopicTypeCreateModalOpen } = useTopicTypeStoreActions()
  const { error, isError, isStoringTopicType, storeTopicType } = useStoreTopicType()
  const [form] = Form.useForm()
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
      await storeTopicType(formattedBody)
      setIsTopicTypeCreateModalOpen(false)
      form.resetFields()
    } catch (error) {
      console.error('Failed to create topic type:', error)
    }
  }
  const handleCancel = () => {
    setIsTopicTypeCreateModalOpen(false)
    form.resetFields()
  }
  return (
    <Modal
      cancelText={__('Cancel')}
      confirmLoading={isStoringTopicType}
      okText={__('Create Topic Type')}
      onCancel={handleCancel}
      onOk={handleOk}
      open={isTopicTypeModalOpen}
      title={__('Create Topic Type')}
    >
      <ProductForm form={form} open={isTopicTypeModalOpen} />
      {errorMessage && <Alert message={errorMessage} type="error" />}
    </Modal>
  )
}
