import { __ } from '@common/helpers/i18nWrap'
import { Button, Popconfirm, Space, Table, type TableColumnsType, Typography } from 'antd'
import { LuPencilLine, LuTrash2 } from 'react-icons/lu'
import { useSearchParams } from 'react-router'

import useDeleteTag from '../data/use-delete-tag'
import useTags from '../data/use-tags'
import { type Tag } from '../shared/types'

export default function TagsTable() {
  const [, setSearchParams] = useSearchParams()
  const { tags } = useTags()
  const { deleteTag, isDeletingTag } = useDeleteTag()

  const handleEdit = (id: number) => {
    setSearchParams({ id: id.toString(), modal: 'edit' })
  }
  const handleDelete = async (id: number) => {
    try {
      await deleteTag(id)
    } catch (error) {
      console.error('Failed to delete tag:', error)
    }
  }

  const columns: TableColumnsType<Tag> = [
    {
      dataIndex: 'name',
      key: 'name',
      title: __('Tag Name')
    },
    {
      dataIndex: 'description',
      key: 'description',
      render: (text: string) =>
        text || <Typography.Text type="secondary">{__('No description')}</Typography.Text>,
      title: __('Description')
    },
    {
      dataIndex: 'actions',
      key: 'actions',
      render: (_, record) => (
        <Space>
          <Button
            aria-label={__('Edit tag')}
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
            title={__('Delete Tag')}
          >
            <Button
              aria-label={__('Delete tag')}
              danger
              disabled={isDeletingTag}
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
    <Table
      columns={columns}
      dataSource={tags}
      pagination={false}
      rowClassName="bg-transparent"
      rowKey="id"
    />
  )
}
