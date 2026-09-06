/* eslint-disable react-hooks/exhaustive-deps */
import { __ } from '@common/helpers/i18nWrap'
import { Grid, Select } from 'antd'
import { useMemo } from 'react'
import { useSearchParams } from 'react-router'

import { useTaxonomiesStoreSelect } from '@/store/use-taxonomies-store'

export default function ProductFilter({ loading = false }: { loading?: boolean }) {
  const [searchParams, setSearchParams] = useSearchParams()
  const productValue = searchParams.get('product') ?? 'all'

  const handleProductChange = (value: string) => {
    setSearchParams(prev => {
      if (prev.has('page')) {
        prev.set('page', '1')
      }

      if (value === 'all') {
        prev.delete('product')
      } else {
        prev.set('product', value)
      }

      return prev
    })
  }

  const products = useTaxonomiesStoreSelect()?.['bit-connect-departments'] || []

  const options = useMemo(
    () => [
      { label: __('All Products'), value: 'all' },
      ...products.map(product => ({
        label: product.name,
        value: product.slug
      }))
    ],
    [products]
  )

  const screens = Grid.useBreakpoint()
  const isMobile = !screens.sm

  return (
    <Select
      className="field-sizing-content topics-filter-select"
      labelRender={({ label }) => (
        <span className={isMobile ? 'bc-font-semibold bc-text-primary' : ''}>{label}</span>
      )}
      loading={loading}
      onChange={handleProductChange}
      options={options}
      popupMatchSelectWidth={false}
      size={isMobile ? 'middle' : 'large'}
      value={productValue}
      variant={isMobile ? 'borderless' : 'filled'}
    />
  )
}
