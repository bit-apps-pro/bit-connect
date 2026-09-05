import { __ } from '@common/helpers/i18nWrap'
import TermIconCell from '@utilities/term-icon-cell'
import {
  dragColumn,
  DragHandle,
  SortableRow,
  SortableTable,
  useSortableRows
} from '@utilities/term-order'
import { Button, Popconfirm, Table, type TableColumnsType, Tag, Typography } from 'antd'
import { LuPencilLine, LuTrash2 } from 'react-icons/lu'
import { useSearchParams } from 'react-router'

import useChipProps from '@/utils/use-chip-props'

import useDeleteTopicType from '../data/use-delete-topic-type'
import useTopicTypes from '../data/use-topic-types'
import { type TopicType } from '../shared/topic-type-types'

const { Text } = Typography

const TAXONOMY = 'bit-connect-topic-types'

export default function TopicTypesTable() {
  const { isTopicTypesPending, topicTypes } = useTopicTypes()
  const { handleDragEnd, rows, sensors } = useSortableRows(topicTypes, TAXONOMY, ['topicTypes'])
  const [, setSearchParams] = useSearchParams()
  const { deleteTopicType, isDeletingTopicType } = useDeleteTopicType()
  const { chipTagProps } = useChipProps()
  const handleEdit = (id: number) => {
    setSearchParams({ id: id.toString(), modal: 'edit' })
  }
  const handleDelete = async (id: number) => {
    try {
      await deleteTopicType(id)
    } catch (error) {
      console.error('Failed to delete topic type:', error)
    }
  }
  const columns: TableColumnsType<TopicType> = [
    { ...dragColumn, render: () => <DragHandle /> },
    {
      dataIndex: 'name',
      key: 'name',
      title: __('Topic Type Name')
    },
    {
      dataIndex: 'color',
      key: 'color',
      render: (_: unknown, record: TopicType) => {
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
      render: (_: unknown, record: TopicType) => <TermIconCell alt={record.name} meta={record.meta} />,
      title: __('Icon')
    },
    {
      dataIndex: 'description',
      key: 'description',
      render: (text: string) => text || <Text type="secondary">{__('No description')}</Text>,
      title: __('Description')
    },
    {
      align: 'center',
      dataIndex: 'actions',
      key: 'actions',
      render: (_, record) => (
        <div className="bc-flex bc-gap-2 bc-justify-center bc-items-center">
          <Button
            className="hover:bc-text-blue-600"
            icon={<LuPencilLine />}
            onClick={() => handleEdit(record.id)}
            type="text"
          />
          <Popconfirm
            cancelText={__('Cancel')}
            description={__('Are you sure to delete?')}
            okButtonProps={{ danger: true }}
            okText={__('Delete')}
            onConfirm={() => handleDelete(record.id)}
            title={__('Delete Topic Type')}
          >
            <Button danger disabled={isDeletingTopicType} icon={<LuTrash2 />} type="text" />
          </Popconfirm>
        </div>
      ),
      title: __('Actions')
    }
  ]
  return (
    <SortableTable items={rows.map(row => row.id)} onDragEnd={handleDragEnd} sensors={sensors}>
      <Table
        columns={columns}
        components={{ body: { row: SortableRow } }}
        dataSource={rows}
        loading={isTopicTypesPending}
        pagination={false}
        rowKey="id"
      />
    </SortableTable>
  )
}
