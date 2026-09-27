import { __ } from '@common/helpers/i18nWrap'
import { Button, Typography } from 'antd'
import { LuPlus } from 'react-icons/lu'

import { useProductStoreActions } from './state/use-product-store'
import ProductCreateModal from './ui/product-create-modal'
import ProductEditModal from './ui/product-edit-modal'
import ProductsTable from './ui/products-table'

const { Text, Title } = Typography

export default function Products() {
  const { setIsProductCreateModalOpen } = useProductStoreActions()
  return (
    <div className="bc-px-6 bc-pb-6">
      <div className="bc-flex bc-flex-wrap bc-items-center bc-justify-between bc-gap-3 bc-pb-4 bc-pt-5">
        <div className="bc-min-w-0">
          <Title className="bc-mb-0.5" level={3}>
            {__('Products')}
          </Title>
          <Text className="bc-text-xs" type="secondary">
            {__('The products your community talks about, so each topic can be filed under one. Drag to reorder.')}
          </Text>
        </div>
        <Button icon={<LuPlus />} onClick={() => setIsProductCreateModalOpen(true)} type="primary">
          {__('Add Product')}
        </Button>
      </div>

      {/* The layout's ground is sunken, so the table sits on its own raised
          card, like the General screen's sections. */}
      <div className="bc-overflow-hidden bc-rounded-lg bc-border bc-border-solid bc-border-line bc-bg-surface">
        <ProductsTable />
      </div>
      <ProductCreateModal />
      <ProductEditModal />
    </div>
  )
}
