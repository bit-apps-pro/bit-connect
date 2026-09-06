import { type ResponseType } from '@common/request/types'
import { wpApi } from '@common/request/wp-api'
import { useQuery } from '@tanstack/react-query'
import { sortByOrder } from '@utilities/term-order'
import { useCallback } from 'react'

import { type Product } from '../shared/types'

/**
 * Shared so an empty result keeps the same identity between renders. The table
 * mirrors this array into local state to reorder it optimistically, and a fresh
 * `[]` each render would resync — and undo the drag — on every render.
 */
const NO_PRODUCTS: Product[] = []

export default function useProducts() {
  // Memoised for the same reason: react-query re-runs `select` whenever the
  // function identity changes, which for an inline arrow is every render.
  const select = useCallback((response: ResponseType<Product[]>) => {
    const products = response?.data ?? response
    if (Array.isArray(products)) {
      return sortByOrder(products.map(product => ({ ...product, meta: product.meta || {} })))
    }
    return NO_PRODUCTS
  }, [])

  const { data, isError, isFetching, isPending, refetch } = useQuery<
    ResponseType<Product[]>,
    Error,
    Product[]
  >({
    queryFn: ({ signal }) =>
      wpApi('bit-connect-departments', { method: 'GET', queryParam: { per_page: 100 }, signal }),
    queryKey: ['departments'],
    select
  })

  return {
    isProductsError: isError,
    isProductsFetching: isFetching,
    isProductsPending: isPending,
    products: isError ? NO_PRODUCTS : (data ?? NO_PRODUCTS),
    refetchProducts: refetch
  }
}
