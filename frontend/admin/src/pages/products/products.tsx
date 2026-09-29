import { __, sprintf } from '@common/helpers/i18nWrap'
import config from '@config/config'
import { Button, Typography } from 'antd'
import { LuPlus } from 'react-icons/lu'

import NamingExtras from './internal/naming-extras'
import { useProductStoreActions } from './state/use-product-store'
import ProductCreateModal from './ui/product-create-modal'
import ProductEditModal from './ui/product-edit-modal'
import ProductsTable from './ui/products-table'

const { Title } = Typography

export default function Products() {
  const { setIsProductCreateModalOpen } = useProductStoreActions()
  const { plural, singular } = config.DEPARTMENT_NAMING
  return (
    <div className="bc-px-6 bc-pb-6">
      <div className="bc-flex bc-flex-wrap bc-items-center bc-justify-between bc-gap-3 bc-pb-4 bc-pt-5">
        <div className="bc-min-w-0">
          <Title className="bc-mb-0" level={3}>
            {plural}
          </Title>
        </div>
        <Button icon={<LuPlus />} onClick={() => setIsProductCreateModalOpen(true)} type="primary">
          {/* translators: %s: what the portal calls a department. */}
          {sprintf(__('Add %s'), singular)}
        </Button>
      </div>

      {NamingExtras && <NamingExtras />}

      {/* The layout's ground is sunken, so the table sits on its own raised
          card, like the General screen's sections. Scrolls sideways rather
          than clipping: on a phone the table is wider than the card, and
          hidden overflow cut its last columns off with no way to reach them. */}
      <div className="bc-overflow-x-auto bc-rounded-lg bc-border bc-border-solid bc-border-line bc-bg-surface">
        <ProductsTable />
      </div>
      <ProductCreateModal />
      <ProductEditModal />
    </div>
  )
}
