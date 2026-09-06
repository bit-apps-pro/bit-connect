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
    <div>
      <div>
        <div className="bc-flex bc-py-6 bc-px-5 bc-justify-between bc-items-center">
          <div>
            <Title className="bc-mb-2" level={2}>
              {__('Products')}
            </Title>
            <Text type="secondary">{__('Manage your products here')}</Text>
          </div>
          <Button
            icon={<LuPlus />}
            onClick={() => setIsProductCreateModalOpen(true)}
            size="large"
            type="primary"
          >
            {__('Add Product')}
          </Button>
        </div>
        <ProductsTable />
      </div>
      <ProductCreateModal />
      <ProductEditModal />
    </div>
  )
}
