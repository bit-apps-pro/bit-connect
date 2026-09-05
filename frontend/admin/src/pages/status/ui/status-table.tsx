import { __ } from '@common/helpers/i18nWrap'
import EditIcon from '@icons/EditIcon'
import TermIconCell from '@utilities/term-icon-cell'
import {
  dragColumn,
  DragHandle,
  SortableRow,
  SortableTable,
  useSortableRows
} from '@utilities/term-order'
import { Popconfirm, type TableColumnsType, Tag, Typography } from 'antd'
import { Button, Table } from 'antd'
import { LuCircleCheck, LuTrash2 } from 'react-icons/lu'
import { useSearchParams } from 'react-router'

import useChipProps from '@/utils/use-chip-props'

import useDeleteStatus from '../data/use-delete-status'
import useStatuses, { STATUSES_QUERY_KEY } from '../data/use-statuses'
import { type Status } from '../shared/types'

const { Text } = Typography

const TAXONOMY = 'bit-connect-statuses'

export default function StatusTable() {
  const { isStatusesPending, statuses } = useStatuses()
  const { handleDragEnd, rows, sensors } = useSortableRows(statuses, TAXONOMY, STATUSES_QUERY_KEY)
  const [, setSearchParams] = useSearchParams()
  const { deleteStatus, isDeletingStatus } = useDeleteStatus()
  const { chipTagProps } = useChipProps()
  const handleEdit = (id: number) => {
    setSearchParams({ id: id.toString(), modal: 'edit' })
  }

  const columns: TableColumnsType<Status> = [
    { ...dragColumn, render: () => <DragHandle /> },
    {
      dataIndex: 'name',
      key: 'name',
      render: (_: unknown, record: Status) => (
        <div className="bc-flex bc-items-center bc-gap-4">
          <Text>{record.name}</Text>
          {record.meta?.is_default && (
            <span className="bc-flex bc-items-center bc-gap-1">
              <LuCircleCheck size={16} />
              <Text>{__('Default')}</Text>
            </span>
          )}
        </div>
      ),
      title: __('Status Name')
    },
    {
      dataIndex: 'color',
      key: 'color',
      render: (_: unknown, record: Status) => {
        if (record.meta?.color) {
          return (
            // The raw swatch alongside the chip the portal will actually
            // render: the picked colour is never painted as a solid fill, so a
            // swatch on its own told an admin nothing about what a reader sees.
            <div className="bc-flex bc-items-center bc-gap-2">
              <div
                className="bc-h-6 bc-w-6 bc-shrink-0 bc-rounded bc-border bc-border-line-strong"
                style={{ backgroundColor: record.meta.color }}
              />
              <Tag className="bc-m-0" {...chipTagProps(record.meta.color)}>
                {record.name}
              </Tag>
              <Text type="secondary">{record.meta.color}</Text>
            </div>
          )
        }
        return <Text type="secondary">{__('No color')}</Text>
      },
      title: __('Color')
    },
    {
      dataIndex: 'icon',
      key: 'icon',
      render: (_: unknown, record: Status) => <TermIconCell alt={record.name} meta={record.meta} />,
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
      render: (_: unknown, record: Status) => (
        <div>
          <Button
            className="hover:bc-text-blue-600"
            icon={<EditIcon size={16} />}
            onClick={() => handleEdit(record.id)}
            type="text"
          />
          <Popconfirm
            cancelText={__('Cancel')}
            description={__('Are you sure to delete?')}
            okButtonProps={{ danger: true }}
            okText={__('Delete')}
            onConfirm={() => deleteStatus(record.id)}
            title={__('Delete Status')}
          >
            <Button
              danger
              disabled={isDeletingStatus || record.meta?.is_default}
              icon={<LuTrash2 size={16} />}
              type="text"
            />
          </Popconfirm>
        </div>
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
        loading={isStatusesPending}
        pagination={false}
        rowKey="id"
      />
    </SortableTable>
  )
}
