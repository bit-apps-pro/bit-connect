import { __ } from '@common/helpers/i18nWrap'
import { Alert, Form, Modal } from 'antd'

import { type ErrorResponse } from '../data/use-store-product'
import useStoreProduct from '../data/use-store-product'
import { useIsProductCreateModalOpen, useProductStoreActions } from '../state/use-product-store'
import ProductForm from './product-form'

const getErrorMessage = (error: ErrorResponse | null, isError: boolean) => {
  if (isError) {
    return error?.errors?.message ?? undefined
  }
  return
}

export default function ProductCreateModal() {
  const isProductModalOpen = useIsProductCreateModalOpen()
  const { setIsProductCreateModalOpen } = useProductStoreActions()
  const { error, isError, isStoringProduct, storeProduct } = useStoreProduct()
  const [form] = Form.useForm()
  const errorMessage = getErrorMessage(error, isError)

  const handleOk = async () => {
    const values = await form.validateFields()
    storeProduct(values)
    form.resetFields()
    setIsProductCreateModalOpen(false)
  }

  const handleCancel = () => {
    setIsProductCreateModalOpen(false)
    form.resetFields()
  }

  return (
    <Modal
      cancelText={__('Cancel')}
      confirmLoading={isStoringProduct}
      // Mount the body before the first open, and keep it mounted after a
      // close, so the Form instance created above is always connected to a
      // <Form>; antd warns otherwise when fields are reset while it is closed.
      forceRender
      okText={__('Create Product')}
      onCancel={handleCancel}
      onOk={handleOk}
      open={isProductModalOpen}
      title={__('Product')}
    >
      <ProductForm form={form} open={isProductModalOpen} />
      {errorMessage && <Alert message={errorMessage} type="error" />}
    </Modal>
  )
}
