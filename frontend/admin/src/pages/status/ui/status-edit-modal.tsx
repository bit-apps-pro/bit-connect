import { __ } from '@common/helpers/i18nWrap'
import slugify from '@common/helpers/slugify'
import { Alert, Form, Modal } from 'antd'
import { useEffect } from 'react'
import { useSearchParams } from 'react-router'

import useStatus from '../data/use-status'
import { type ErrorResponse } from '../data/use-store-status'
import useUpdateStatus from '../data/use-update-status'
import { useIsEditStatusModalOpen, useStatusStoreActions } from '../state/use-status-store'
import StatusForm from './status-form'

const getErrorMessage = (error: ErrorResponse | null, isError: boolean) => {
  if (isError) {
    return error?.errors?.message ?? undefined
  }
  return
}

export default function StatusEditModal() {
  const [form] = Form.useForm()
  const isEditStatusModalOpen = useIsEditStatusModalOpen()
  const { setIsEditStatusModalOpen } = useStatusStoreActions()
  const [searchParams, setSearchParams] = useSearchParams()
  const { isFetching, isPending, status } = useStatus(Number(searchParams.get('id')))
  const { error, isError, isUpdatingStatus, updateStatus } = useUpdateStatus()
  const errorMessage = getErrorMessage(error, isError)

  useEffect(() => {
    if (!searchParams.has('modal') || !searchParams.has('id') || searchParams.get('id') === '0') {
      setIsEditStatusModalOpen(false)
      return
    }

    if (searchParams.get('modal') === 'edit') {
      setIsEditStatusModalOpen(true)
      return
    }
    setIsEditStatusModalOpen(false)
  }, [searchParams, setIsEditStatusModalOpen])

  useEffect(() => {
    if (status && status.id) {
      form.setFieldsValue({
        color: status.meta?.bit_connect_color,
        description: status.description,
        icon_dark_id: status.meta?.bit_connect_icon_dark_id || 0,
        icon_dark_url: status.meta?.bit_connect_icon_dark_url,
        icon_file_name: status.iconFileName,
        icon_id: status.meta?.bit_connect_icon_id || 0,
        icon_url: status.meta?.bit_connect_icon_url,
        name: status.name,
        slug: status.slug
      })
    }
  }, [status, form])

  const handleOnCancel = () => {
    form.resetFields()
    setIsEditStatusModalOpen(false)
    setSearchParams({})
  }

  const handleOk = async () => {
    try {
      const values = await form.validateFields()
      const id = Number(searchParams.get('id'))
      const formattedBody = {
        description: values.description,
        meta: {
          bit_connect_color: values.color,
          bit_connect_icon_dark_id: values.icon_dark_id || 0,
          bit_connect_icon_dark_url: values.icon_dark_url,
          bit_connect_icon_id: values.icon_id || 0,
          bit_connect_icon_url: values.icon_url
        },
        name: values.name,
        ...(values.slug ? { slug: slugify(values.slug) } : {})
      }
      await updateStatus({ body: formattedBody, id })
      setSearchParams({})
      setIsEditStatusModalOpen(false)
      form.resetFields()
    } catch (error) {
      console.error('Validation failed:', error)
    }
  }
  return (
    <Modal
      cancelText={__('Cancel')}
      confirmLoading={isUpdatingStatus}
      // Mount the body before the first open, and keep it mounted after a
      // close, so the Form instance created above is always connected to a
      // <Form>; antd warns otherwise when fields are reset while it is closed.
      forceRender
      loading={isFetching || isPending}
      okText={__('Save Changes')}
      onCancel={handleOnCancel}
      onOk={handleOk}
      open={isEditStatusModalOpen}
      title={__('Edit Status')}
    >
      <StatusForm form={form} isEditMode open={isEditStatusModalOpen} />
      {errorMessage && <Alert message={errorMessage} type="error" />}
    </Modal>
  )
}
