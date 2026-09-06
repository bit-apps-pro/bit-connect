import { __ } from '@common/helpers/i18nWrap'
import { Alert, Form, Modal } from 'antd'
import { useEffect } from 'react'
import { useSearchParams } from 'react-router'

import { type ErrorResponse } from '../data/use-store-tag'
import { useTag } from '../data/use-tag'
import useUpdateTag from '../data/use-update-tag'
import { useIsEditModalOpenSelect, useTagStoreActions } from '../state/use-tag-store'
import TagForm from './tag-form'

const getErrorMessage = (error: ErrorResponse | null, isError: boolean) => {
  if (isError) {
    return error?.errors?.message ?? undefined
  }
  return
}

export default function TagEditModal() {
  const [searchParams, setSearchParams] = useSearchParams()
  const isEditModalOpen = useIsEditModalOpenSelect()
  const { isTagFetching, tag } = useTag(Number(searchParams.get('id')))
  const { setIsEditModalOpen } = useTagStoreActions()
  const [form] = Form.useForm()
  const { error, isError, isUpdatingTag, updateTag } = useUpdateTag()
  const errorMessage = getErrorMessage(error, isError)

  useEffect(() => {
    if (!searchParams.has('modal') || !searchParams.has('id') || searchParams.get('id') === '0') {
      setIsEditModalOpen(false)
      return
    }

    if (searchParams.get('modal') === 'edit') {
      setIsEditModalOpen(true)
      return
    }

    setIsEditModalOpen(false)
  }, [searchParams, setIsEditModalOpen])

  useEffect(() => {
    if (!isEditModalOpen) {
      form.resetFields()
      return
    }

    if (tag && tag.id) {
      form.setFieldsValue(tag)
    }
  }, [isEditModalOpen, tag, form])

  const handleCancel = () => {
    form.resetFields()
    setIsEditModalOpen(false)
    setSearchParams({})
  }
  const handleOk = async () => {
    try {
      const values = await form.validateFields()
      const id = Number(searchParams.get('id'))
      await updateTag({ id, ...values })
      setSearchParams({})
      form.resetFields()
      setIsEditModalOpen(false)
    } catch (error) {
      console.error('Failed to update tag:', error)
    }
  }
  return (
    <Modal
      cancelText={__('Cancel')}
      confirmLoading={isUpdatingTag}
      destroyOnClose
      loading={isTagFetching}
      okButtonProps={{ disabled: isUpdatingTag }}
      okText={__('Save Changes')}
      onCancel={handleCancel}
      onOk={handleOk}
      open={isEditModalOpen}
      title={__('Edit Tag')}
    >
      <TagForm form={form} isEditMode open={isEditModalOpen} />
      {errorMessage && <Alert message={errorMessage} type="error" />}
    </Modal>
  )
}
