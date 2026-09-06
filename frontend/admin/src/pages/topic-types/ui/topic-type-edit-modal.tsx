import { __ } from '@common/helpers/i18nWrap'
import slugify from '@common/helpers/slugify'
import { Alert, Form, Modal } from 'antd'
import { useEffect } from 'react'
import { useSearchParams } from 'react-router'

import { type ErrorResponse } from '../data/use-store-topic-type'
import useTopicType from '../data/use-topic-type'
import useUpdateTopicType from '../data/use-update-topic-type'
import { useIsTopicTypeEditModalOpen, useTopicTypeStoreActions } from '../state/use-topic-type-store'
import ProductForm from './topic-type-form'

const getErrorMessage = (error: ErrorResponse | null, isError: boolean) => {
  if (isError) {
    return error?.errors?.message ?? undefined
  }
  return
}

export default function TopicTypeEditModal() {
  const isTopicTypeEditModalOpen = useIsTopicTypeEditModalOpen()
  const { setIsTopicTypeEditModalOpen } = useTopicTypeStoreActions()
  const [searchParams, setSearchParams] = useSearchParams()
  const [form] = Form.useForm()
  const { isFetching: isTopicTypeFetching, topicType } = useTopicType(Number(searchParams.get('id')))
  const { error, isError, isUpdatingTopicType, updateTopicType } = useUpdateTopicType()
  const errorMessage = getErrorMessage(error, isError)

  useEffect(() => {
    if (!searchParams.has('modal') || !searchParams.has('id') || searchParams.get('id') === '0') {
      setIsTopicTypeEditModalOpen(false)
      return
    }

    if (searchParams.get('modal') === 'edit') {
      setIsTopicTypeEditModalOpen(true)
      return
    }
    setIsTopicTypeEditModalOpen(false)
  }, [searchParams, setIsTopicTypeEditModalOpen])

  useEffect(() => {
    if (!isTopicTypeEditModalOpen) {
      form.resetFields()
      return
    }

    if (topicType && topicType.id) {
      form.setFieldsValue({
        color: topicType.meta?.color,
        description: topicType.description,
        icon_dark_id: topicType.meta?.icon_dark_id || 0,
        icon_dark_url: topicType.meta?.icon_dark_url,
        icon_file_name: topicType.iconFileName,
        icon_id: topicType.meta?.icon_id || 0,
        icon_url: topicType.meta?.icon_url,
        name: topicType.name,
        slug: topicType.slug
      })
    }
  }, [isTopicTypeEditModalOpen, topicType, form])

  const handleCancel = () => {
    setIsTopicTypeEditModalOpen(false)
    setSearchParams({})
    form.resetFields()
  }
  const handleOk = async () => {
    try {
      const values = await form.validateFields()
      const id = Number(searchParams.get('id'))
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
      await updateTopicType({ body: formattedBody, id })
      setSearchParams({})
      setIsTopicTypeEditModalOpen(false)
      form.resetFields()
    } catch (error) {
      console.error('Failed to update topic type:', error)
    }
  }

  return (
    <Modal
      cancelText={__('Cancel')}
      confirmLoading={isUpdatingTopicType}
      loading={isTopicTypeFetching}
      okText={__('Save Changes')}
      onCancel={handleCancel}
      onOk={handleOk}
      open={isTopicTypeEditModalOpen}
      title={__('Edit Topic Type')}
    >
      <ProductForm form={form} isEditMode open={isTopicTypeEditModalOpen} />
      {errorMessage && <Alert message={errorMessage} type="error" />}
    </Modal>
  )
}
