import { __, sprintf } from '@common/helpers/i18nWrap'
import config from '@config/config'
import TermIconCell from '@utilities/term-icon-cell'
import {
  dragColumn,
  DragHandle,
  SortableRow,
  SortableTable,
  useSortableRows
} from '@utilities/term-order'
import { Button, Popconfirm, Space, Table, type TableColumnsType } from 'antd'
import { LuPencilLine, LuTrash2 } from 'react-icons/lu'
import { useSearchParams } from 'react-router'

import useDeleteProduct from '../data/use-delete-product'
import useProducts from '../data/use-products'
import { type Product } from '../shared/types'

const TAXONOMY = 'bit-connect-departments'

export default function ProductsTable() {
  const { singular } = config.DEPARTMENT_NAMING
  const { isProductsPending, products } = useProducts()
  const { handleDragEnd, rows, sensors } = useSortableRows(products, TAXONOMY, ['departments'])
  const [, setSearchParams] = useSearchParams()
  const { deleteProduct, isDeletingProduct } = useDeleteProduct()
  const handleEdit = (id: number) => {
    setSearchParams({ id: id.toString(), modal: 'edit' })
  }
  const handleDelete = async (id: number) => {
    try {
      await deleteProduct(id)
    } catch (error) {
      console.error('Failed to delete department:', error)
    }
  }
  const columns: TableColumnsType<Product> = [
    { ...dragColumn, render: () => <DragHandle /> },
    {
      dataIndex: 'name',
      key: 'name',
      title: __('Name')
    },
    {
      dataIndex: 'icon',
      key: 'icon',
      render: (_: unknown, record: Product) => <TermIconCell alt={record.name} meta={record.meta} />,
      title: __('Icon')
    },
    {
      dataIndex: 'description',
      key: 'description',
      title: __('Description')
    },
    {
      dataIndex: 'actions',
      key: 'actions',
      render: (_, record: Product) => (
        <Space>
          <Button
            aria-label={sprintf(__('Edit %s'), singular)}
            className="hover:bc-text-blue-600"
            icon={<LuPencilLine size={16} />}
            onClick={() => handleEdit(record.id)}
            type="text"
          />
          <Popconfirm
            cancelText={__('Cancel')}
            description={__('Are you sure to delete?')}
            okButtonProps={{ danger: true }}
            okText={__('Delete')}
            onConfirm={() => handleDelete(record.id)}
            title={sprintf(__('Delete %s'), singular)}
          >
            <Button
              aria-label={sprintf(__('Delete %s'), singular)}
              danger
              disabled={isDeletingProduct}
              icon={<LuTrash2 size={16} />}
              type="text"
            />
          </Popconfirm>
        </Space>
      ),
      title: __('Actions')
    }
  ]
  return (
    // Unpaginated: a row on another page cannot be a drop target, and the list
    // is already fetched in one request.
    <SortableTable items={rows.map(row => row.id)} onDragEnd={handleDragEnd} sensors={sensors}>
      <Table
        columns={columns}
        components={{ body: { row: SortableRow } }}
        dataSource={rows}
        loading={isProductsPending}
        pagination={false}
        rowKey="id"
      />
    </SortableTable>
  )
}
