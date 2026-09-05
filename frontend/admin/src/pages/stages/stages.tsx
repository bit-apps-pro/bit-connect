import { __ } from '@common/helpers/i18nWrap'
import TermIconCell from '@utilities/term-icon-cell'
import {
  dragColumn,
  DragHandle,
  SortableRow,
  SortableTable,
  useSortableRows
} from '@utilities/term-order'
import { Button, Form, Popconfirm, Space, Table, Typography } from 'antd'
import { useState } from 'react'
import { LuPenLine, LuPlus, LuTrash2 } from 'react-icons/lu'

import useDeleteStage from './data/use-delete-stage'
import { type ErrorResponse } from './data/use-save-stage'
import useSaveStage from './data/use-save-stage'
import useStages from './data/use-stages'
import useUpdateStage from './data/use-update-stage'
import StageModal from './internal/stage-modal'
import { type Stage, type StageFormData } from './shared/types'

const TAXONOMY = 'bit-connect-stages'

const { Text, Title } = Typography

const getErrorMessage = (error: ErrorResponse | null, isError: boolean) => {
  if (isError) {
    return error?.errors?.message ?? undefined
  }
  return
}

export default function Stages() {
  const [form] = Form.useForm<StageFormData>()
  const [editingStage, setEditingStage] = useState<Stage>()
  const [modalOpen, setModalOpen] = useState(false)
  const { isStagesPending, stages } = useStages()
  const { error, isError, isSavingStage, saveStage } = useSaveStage()
  const { error: updateError, isError: isUpdateError, isUpdatingStage, updateStage } = useUpdateStage()
  const { deleteStage, isDeletingStage } = useDeleteStage()
  const { handleDragEnd, rows, sensors } = useSortableRows(stages, TAXONOMY, ['stages'])

  const handleCreate = () => {
    setEditingStage(undefined)
    form.resetFields()
    setModalOpen(true)
  }

  const handleEdit = (stage: Stage) => {
    setEditingStage(stage)
    form.setFieldsValue({
      description: stage.description,
      icon_dark_id: stage.meta?.icon_dark_id || 0,
      icon_dark_url: stage.meta?.icon_dark_url,
      icon_file_name: stage.iconFileName,
      icon_id: stage.meta?.icon_id || 0,
      icon_url: stage.meta?.icon_url,
      name: stage.name,
      slug: stage.slug
    })
    setModalOpen(true)
  }

  const handleDelete = async (id: number) => {
    await deleteStage(id)
  }

  const handleModalSubmit = async (data: StageFormData) => {
    try {
      const formattedBody = {
        description: data.description,
        meta: {
          // Send the icon keys even when empty. WordPress deletes a meta sent
          // as null but ignores one that never arrives, and `wpApi` serialises
          // undefined to null — so an omitted key would leave a removed icon
          // in place.
          icon_dark_id: data.icon_dark_id || 0,
          icon_dark_url: data.icon_dark_url,
          icon_id: data.icon_id || 0,
          icon_url: data.icon_url
        },
        name: data.name,
        ...(data.slug ? { slug: data.slug } : {})
      }
      await (editingStage
        ? updateStage({ id: editingStage.id, ...formattedBody })
        : saveStage(formattedBody))
      setModalOpen(false)
      setEditingStage(undefined)
      form.resetFields()
    } catch (error) {
      console.error('Failed to save stage:', error)
    }
  }

  const handleModalCancel = () => {
    setModalOpen(false)
    setEditingStage(undefined)
    form.resetFields()
  }

  const columns = [
    { ...dragColumn, render: () => <DragHandle /> },
    {
      dataIndex: 'name',
      key: 'name',
      title: __('Stage Name')
    },
    {
      dataIndex: 'description',
      key: 'description',
      render: (text: string) => text || <Text type="secondary">{__('No description')}</Text>,
      title: __('Description')
    },
    {
      key: 'icon',
      render: (_: unknown, record: Stage) => <TermIconCell alt={record.name} meta={record.meta} />,
      title: __('Icon')
    },
    {
      key: 'actions',
      render: (_: unknown, record: Stage) => {
        return (
          <Space>
            <Button
              aria-label={__('Edit stage')}
              icon={<LuPenLine size={16} />}
              onClick={() => handleEdit(record)}
              type="text"
            />
            <Popconfirm
              cancelText={__('Cancel')}
              description={__('Are you sure to delete?')}
              okButtonProps={{ danger: true }}
              okText={__('Delete')}
              onConfirm={() => handleDelete(record.id)}
              title={__('Delete Stage')}
            >
              <Button
                aria-label={__('Delete stage')}
                danger
                disabled={record.meta?.is_default || isDeletingStage}
                icon={<LuTrash2 size={16} />}
                type="text"
              />
            </Popconfirm>
          </Space>
        )
      },
      title: __('Actions')
    }
  ]

  return (
    <div>
      <div className=" bc-py-6 bc-px-5 bc-flex bc-items-center bc-justify-between">
        <div>
          <Title className="bc-mb-2" level={2}>
            {__('Stage')}
          </Title>
          <Text type="secondary">{__('Manage stages for your project')}</Text>
        </div>
        <Button icon={<LuPlus />} onClick={handleCreate} size="large" type="primary">
          {__('Create Stage')}
        </Button>
      </div>

      <SortableTable items={rows.map(stage => stage.id)} onDragEnd={handleDragEnd} sensors={sensors}>
        <Table
          columns={columns}
          components={{ body: { row: SortableRow } }}
          dataSource={rows}
          loading={isStagesPending}
          pagination={false}
          rowClassName="bg-transparent"
          rowKey="id"
        />
      </SortableTable>

      <StageModal
        errorMessage={getErrorMessage(error || updateError, isError || isUpdateError)}
        form={form}
        isSubmitting={isSavingStage || isUpdatingStage}
        onCancel={handleModalCancel}
        onSubmit={handleModalSubmit}
        open={modalOpen}
        stage={editingStage}
      />
    </div>
  )
}
