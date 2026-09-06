import NotifyContext from '@common/context/NotifyContext'
import { __ } from '@common/helpers/i18nWrap'
import { type Response } from '@common/helpers/request'
import { wpApi } from '@common/request/wp-api'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useContext } from 'react'

import { type Product, type ProductFormData } from '../shared/types'
import { type ErrorResponse } from './use-store-product'

interface UpdateProductData extends ProductFormData {
  id: number
}

export default function useUpdateProduct() {
  const queryClient = useQueryClient()
  const { messageApi } = useContext(NotifyContext)

  const { error, isError, isPending, mutateAsync } = useMutation<
    Response<Product>,
    ErrorResponse,
    UpdateProductData
  >({
    mutationFn: async ({ id, ...productData }) => {
      return wpApi<UpdateProductData, Product>(`bit-connect-departments/${id}`, {
        body: { id, ...productData },
        method: 'PUT'
      })
    },
    mutationKey: ['departments', 'update'],
    onError: () => {
      messageApi?.error(__('Failed to update product'))
    },
    onSuccess: () => {
      messageApi?.success(__('Product updated successfully'))
      queryClient.invalidateQueries({ queryKey: ['departments'] })
    }
  })

  return {
    error: error,
    isError: isError,
    isUpdatingProduct: isPending,
    updateProduct: mutateAsync
  }
}
