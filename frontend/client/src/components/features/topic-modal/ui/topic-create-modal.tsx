import { __ } from '@common/helpers/i18nWrap'
import useFileStore from '@features/file-uploader/state/use-file-store'
import { Button, Form, Modal } from 'antd'
import { useEffect } from 'react'

import { useTaxonomiesStoreSelect } from '@/store/use-taxonomies-store'

import useSaveTopic from '../data/use-save-topic'
import useTopicModalStore from '../state/use-topic-modal-store'
import TopicForm from './topic-form'

export default function TopicCreateModal() {
  const { isCreateModalOpen, setCreateModalOpen } = useTopicModalStore()
  const { clearFiles, files, resetFiles } = useFileStore()
  const [form] = Form.useForm()
  const taxonomies = useTaxonomiesStoreSelect()
  const { isSavingTopic, saveTopic } = useSaveTopic(form)

  useEffect(() => {
    if (!isCreateModalOpen) return

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault()
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [isCreateModalOpen])

  const handleClose = () => {
    setCreateModalOpen(false)
    form.resetFields()
    clearFiles()
  }

  const handleSubmit = async () => {
    const values = await form.validateFields()

    const hasUploading = files.some(f => f.isUploading)
    if (hasUploading) return

    const attachmentIds = files.filter(f => f.wp_id).map(f => f.wp_id as number)

    const payload = {
      ...values,
      attachments: attachmentIds
    }

    try {
      await saveTopic(payload)
    } catch {
      return
    }

    form.resetFields()
    resetFiles()
    setCreateModalOpen(false)
  }

  return (
    <Modal
      centered
      footer={
        <div className="bc-flex bc-w-full bc-gap-2">
          <Button block key="cancel" onClick={handleClose}>
            {__('Cancel')}
          </Button>
          <Button
            block
            disabled={files.some(f => f.isUploading) || isSavingTopic}
            key="submit"
            loading={isSavingTopic}
            onClick={handleSubmit}
            type="primary"
          >
            {files.some(f => f.isUploading) ? __('Uploading files...') : __('Submit')}
          </Button>
        </div>
      }
      onCancel={handleClose}
      onOk={handleSubmit}
      open={isCreateModalOpen}
      styles={{
        body: {
          marginInline: '-22px',
          maxHeight: '70vh',
          overflowY: 'auto',
          paddingInline: '22px'
        }
      }}
      title={__('Create New Topic')}
    >
      {isCreateModalOpen && <TopicForm form={form} taxonomies={taxonomies} />}
    </Modal>
  )
}
