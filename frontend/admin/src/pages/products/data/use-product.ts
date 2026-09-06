import { type ResponseType } from '@common/request/types'
import { wpApi } from '@common/request/wp-api'
import { useQuery } from '@tanstack/react-query'

import { type Product } from '../shared/types'

export default function useProduct(id: number) {
  const { data, isError, isFetching, isPending, refetch } = useQuery<
    ResponseType<Product>,
    Error,
    Product
  >({
    enabled: !!id && id > 0,
    queryFn: ({ signal }) => wpApi(`bit-connect-departments/${id}`, { method: 'GET', signal }),
    queryKey: ['department', id]
  })

  return {
    isProductError: isError,
    isProductFetching: isFetching,
    isProductPending: isPending,
    product: data,
    refetchProduct: refetch
  }
}
