import { __ } from '@common/helpers/i18nWrap'
import { Alert, Form, Modal } from 'antd'
import { useEffect } from 'react'
import { useSearchParams } from 'react-router'

import useProduct from '../data/use-product'
import { type ErrorResponse } from '../data/use-store-product'
import useUpdateProduct from '../data/use-update-product'
import { useIsProductEditModalOpen, useProductStoreActions } from '../state/use-product-store'
import ProductForm from './product-form'

const getErrorMessage = (error: ErrorResponse | null, isError: boolean) => {
  if (isError) {
    return error?.errors?.message ?? undefined
  }
  return
}

export default function ProductEditModal() {
  const isProductEditModalOpen = useIsProductEditModalOpen()
  const { setIsProductEditModalOpen } = useProductStoreActions()
  const [searchParams, setSearchParams] = useSearchParams()
  const [form] = Form.useForm()
  const { product } = useProduct(Number(searchParams.get('id')))
  const { error, isError, isUpdatingProduct, updateProduct } = useUpdateProduct()
  const errorMessage = getErrorMessage(error, isError)

  useEffect(() => {
    if (!searchParams.has('modal') || !searchParams.has('id') || searchParams.get('id') === '0') {
      setIsProductEditModalOpen(false)
      return
    }

    if (searchParams.get('modal') === 'edit') {
      setIsProductEditModalOpen(true)
      return
    }
    setIsProductEditModalOpen(false)
  }, [searchParams, setIsProductEditModalOpen])

  useEffect(() => {
    if (product && product.id) {
      const currentValues = form.getFieldsValue()
      const hasValues = Object.values(currentValues).some(
        val => val !== undefined && val !== null && val !== ''
      )

      if (!hasValues) {
        form.setFieldsValue(product)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [product?.id])

  const handleCancel = () => {
    setIsProductEditModalOpen(false)
    setSearchParams({})
  }
  const handleOk = async () => {
    const values = await form.validateFields()
    const id = Number(searchParams.get('id'))
    updateProduct({ id, ...values })
    setSearchParams({})
    form.resetFields()
    setIsProductEditModalOpen(false)
  }

  return (
    <Modal
      cancelText={__('Cancel')}
      confirmLoading={isUpdatingProduct}
      okText={__('Save Changes')}
      onCancel={handleCancel}
      onOk={handleOk}
      open={isProductEditModalOpen}
      title={__('Edit Product')}
    >
      <ProductForm form={form} isEditMode open={isProductEditModalOpen} />
      {errorMessage && <Alert message={errorMessage} type="error" />}
    </Modal>
  )
}
