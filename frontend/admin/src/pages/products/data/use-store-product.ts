import NotifyContext from '@common/context/NotifyContext'
import { __ } from '@common/helpers/i18nWrap'
import { type Response } from '@common/helpers/request'
import { wpApi } from '@common/request/wp-api'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useContext } from 'react'

import { type Product, type ProductFormData } from '../shared/types'

export interface ErrorResponse {
  errors: { message: string }
}

export default function useStoreProduct() {
  const queryClient = useQueryClient()
  const { messageApi } = useContext(NotifyContext)

  const { error, isError, isPending, mutateAsync } = useMutation<
    Response<Product>,
    ErrorResponse,
    ProductFormData
  >({
    mutationFn: async productData => {
      await new Promise(resolve => setTimeout(resolve, 500))
      return wpApi('bit-connect-departments', { body: productData, method: 'POST' })
    },
    mutationKey: ['departments', 'store'],
    onSuccess: () => {
      messageApi?.success(__('Product created successfully'))
      queryClient.invalidateQueries({ queryKey: ['departments'] })
    }
  })

  return {
    error: error,
    isError: isError,
    isStoringProduct: isPending,
    storeProduct: mutateAsync
  }
}
