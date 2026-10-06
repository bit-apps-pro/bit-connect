import { __, sprintf } from '@common/helpers/i18nWrap'
import { termNameColumn } from '@utilities/term-name-column'
import { Tag as AntTag, Button, Popconfirm, Space, Table, type TableColumnsType, Typography } from 'antd'
import { useMemo, useState } from 'react'
import { LuCheck, LuMerge, LuPencilLine, LuTrash2 } from 'react-icons/lu'
import { useSearchParams } from 'react-router'

import useApproveTag from '../data/use-approve-tag'
import useDeleteTag from '../data/use-delete-tag'
import useTags from '../data/use-tags'
import { type Tag } from '../shared/types'
import TagMergeModal from './tag-merge-modal'

export type TagsView = 'all' | 'pending'

/** What deleting this tag does to the topics under it. */
const deleteWarning = (tag: Tag) => {
  if (tag.count === 0) return __('No topic uses this tag.')

  return sprintf(
    // translators: %s: number of topics
    __('%s topics use this tag. They will keep their other tags. To keep them together, merge instead.'),
    String(tag.count)
  )
}

/** Deleting a suggestion is how it is turned down. */
const rejectWarning = (tag: Tag) =>
  sprintf(
    // translators: 1: who suggested the tag, 2: number of topics
    __(
      'Turns down the tag %1$s suggested. The %2$s topics carrying it keep their other tags. To fold it into an existing tag instead, merge.'
    ),
    tag.created_by || __('a member'),
    String(tag.count)
  )

/** Whether a tag matches what the admin typed, by name or description. */
const matches = (tag: Tag, query: string) => {
  const needle = query.toLowerCase()

  return tag.name.toLowerCase().includes(needle) || (tag.description ?? '').toLowerCase().includes(needle)
}

export default function TagsTable({ search = '', view = 'all' }: { search?: string; view?: TagsView }) {
  const [, setSearchParams] = useSearchParams()
  const { tags } = useTags()
  const { deleteTag, isDeletingTag } = useDeleteTag()
  const { approveTag, isApprovingTag } = useApproveTag()
  const [mergeSource, setMergeSource] = useState<Tag>()

  const shown = useMemo(
    () => tags?.filter(tag => (view === 'all' || tag.pending) && (search === '' || matches(tag, search))),
    [tags, search, view]
  )

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

  const emptyText = (() => {
    if (search !== '') {
      return sprintf(
        // translators: %s: what the admin typed in the search box.
        __('No tag matches “%s”.'),
        search
      )
    }

    return view === 'pending' ? __('No suggested tags are waiting for review.') : __('No tags yet.')
  })()

  const columns: TableColumnsType<Tag> = [
    {
      ...termNameColumn,
      dataIndex: 'name',
      key: 'name',
      render: (name: string, record) => (
        <span className="bc-inline-flex bc-flex-wrap bc-items-center bc-gap-2">
          {name}
          {record.pending && (
            <AntTag className="bc-m-0" color="gold">
              {__('Pending review')}
            </AntTag>
          )}
        </span>
      ),
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
      dataIndex: 'created_by',
      key: 'created_by',
      // Who added it, when a member did. An admin-created tag says nothing:
      // the column is for seeing where the vocabulary is coming from.
      render: (name: string) => name || <Typography.Text type="secondary">—</Typography.Text>,
      title: __('Suggested by')
    },
    {
      // Usage is what an admin prunes and merges by, so it sorts.
      align: 'right',
      dataIndex: 'count',
      key: 'count',
      sorter: (a, b) => a.count - b.count,
      title: __('Topics'),
      width: 100
    },
    {
      dataIndex: 'actions',
      key: 'actions',
      render: (_, record) => (
        <Space>
          {record.pending && (
            <Button
              aria-label={__('Approve tag')}
              disabled={isApprovingTag}
              icon={<LuCheck size={16} />}
              onClick={() => approveTag(record.id)}
              title={__('Approve: offer this tag to everyone')}
              type="text"
            />
          )}
          <Button
            aria-label={__('Edit tag')}
            className="hover:bc-text-blue-600"
            icon={<LuPencilLine size={16} />}
            onClick={() => handleEdit(record.id)}
            type="text"
          />
          <Button
            aria-label={__('Merge tag into another')}
            // One tag has nothing to merge into.
            disabled={(tags?.length ?? 0) < 2}
            icon={<LuMerge size={16} />}
            onClick={() => setMergeSource(record)}
            title={__('Merge into another tag')}
            type="text"
          />
          <Popconfirm
            cancelText={__('Cancel')}
            description={record.pending ? rejectWarning(record) : deleteWarning(record)}
            okButtonProps={{ danger: true }}
            okText={record.pending ? __('Reject') : __('Delete')}
            onConfirm={() => handleDelete(record.id)}
            title={record.pending ? __('Reject suggested tag') : __('Delete Tag')}
          >
            <Button
              aria-label={record.pending ? __('Reject tag') : __('Delete tag')}
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
    <>
      <Table
        columns={columns}
        dataSource={shown}
        locale={{ emptyText }}
        pagination={false}
        rowClassName="bg-transparent"
        rowKey="id"
      />
      <TagMergeModal onClose={() => setMergeSource(undefined)} source={mergeSource} tags={tags ?? []} />
    </>
  )
}
