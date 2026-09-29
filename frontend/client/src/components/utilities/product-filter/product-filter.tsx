/* eslint-disable react-hooks/exhaustive-deps */
import { __, sprintf } from '@common/helpers/i18nWrap'
import config from '@config/config'
import { routePath } from '@utils/route-path'
import { Grid, Select } from 'antd'
import { useMemo } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router'

import { useTaxonomiesStoreSelect } from '@/store/use-taxonomies-store'

export default function ProductFilter({ loading = false }: { loading?: boolean }) {
  const [searchParams, setSearchParams] = useSearchParams()
  const navigate = useNavigate()
  const { pathname } = useLocation()

  // On the list and on a department's archive, picking a department opens that
  // department's archive (`/department/bit-crm`), the one URL search indexes
  // for it. Elsewhere — a stage or tag archive — it narrows that archive, and
  // the query string is the only place the second filter can go.
  const departmentSegment = config.DEPARTMENT_NAMING.slug
  const [segment, termSlug] = pathname.split('/').filter(Boolean)
  const onDepartmentArchive = segment === departmentSegment && termSlug !== undefined
  const opensArchive = onDepartmentArchive || segment === undefined || segment === 'page'
  const productValue = onDepartmentArchive ? termSlug : (searchParams.get('product') ?? 'all')

  const handleProductChange = (value: string) => {
    if (opensArchive) {
      const query = new URLSearchParams(searchParams)
      query.delete('product')
      query.delete('page')

      navigate({
        pathname: routePath(value === 'all' ? '/' : `/${departmentSegment}/${value}`),
        search: query.toString()
      })

      return
    }

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
      // translators: %s: what the portal calls its departments, plural.
      { label: sprintf(__('All %s'), config.DEPARTMENT_NAMING.plural), value: 'all' },
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
      variant={isMobile ? 'borderless' : 'outlined'}
    />
  )
}
