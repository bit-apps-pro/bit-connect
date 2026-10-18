import { __ } from '@common/helpers/i18nWrap'
import useFileStore from '@features/file-uploader/state/use-file-store'
import { Button, Form, Modal } from 'antd'
import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router'

import { useTaxonomiesStoreSelect } from '@/store/use-taxonomies-store'

import createdTopicListing from '../data/created-topic-listing'
import useSaveTopic from '../data/use-save-topic'
import useVisibilityOptions from '../data/use-visibility-options'
import { type CreatedTopicState } from '../shared/created-topic'
import { TOPIC_MODAL_MASK, TOPIC_MODAL_WIDTH } from '../shared/modal-width'
import { type Topic } from '../shared/type'
import useTopicModalStore from '../state/use-topic-modal-store'
import TopicForm from './topic-form'

export default function TopicCreateModal() {
  const { isCreateModalOpen, setCreateModalOpen } = useTopicModalStore()
  const { clearFiles, files, resetFiles } = useFileStore()
  const [form] = Form.useForm()
  const navigate = useNavigate()
  const taxonomies = useTaxonomiesStoreSelect()
  const { isSavingTopic, saveTopic } = useSaveTopic(form)
  // The button says what it will do: a visibility that changes who reads the
  // topic says so on the button too, so the choice above is not missed.
  const status = Form.useWatch('post_status', form) as string | undefined
  const submitLabel = useVisibilityOptions().find(option => option.value === status)?.submitLabel ?? __('Submit')

  useEffect(() => {
    if (!isCreateModalOpen) return

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault()
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [isCreateModalOpen])

  // The form stays drawn, as filled in, until the modal has finished closing,
  // and is cleared only then: cleared first, it went blank while still fading
  // out. Mounted afresh on the next open, as before.
  const [isFormShown, setFormShown] = useState(isCreateModalOpen)
  if (isCreateModalOpen && !isFormShown) setFormShown(true)
  // A created topic's files belong to it now; a cancelled form's are let go.
  const wasCreated = useRef(false)

  const handleAfterClose = () => {
    form.resetFields()
    if (wasCreated.current) resetFiles()
    else clearFiles()
    wasCreated.current = false
    setFormShown(false)
  }

  const handleClose = () => setCreateModalOpen(false)

  const handleSubmit = async () => {
    const values = await form.validateFields()

    const hasUploading = files.some(f => f.isUploading)
    if (hasUploading) return

    const attachmentIds = files.filter(f => f.wp_id).map(f => f.wp_id as number)

    const payload = {
      ...values,
      attachments: attachmentIds
    }

    let created: Topic | undefined
    try {
      const response = await saveTopic(payload)
      created = response.data
    } catch {
      return
    }

    wasCreated.current = true
    setCreateModalOpen(false)

    // To the list the topic is shown in — see created-topic-listing — with
    // the topic picked out in it. Left on the list the form was opened from,
    // its author often could not find it: opened from another stage, or a list
    // filtered away from it. The sidebar's own link for that list is the one
    // followed, so the sidebar marks it too.
    if (created) {
      const state: CreatedTopicState = { createdTopicId: created.ID }
      navigate(createdTopicListing(created), { state })
    }
  }

  return (
    <Modal
      afterClose={handleAfterClose}
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
            {files.some(f => f.isUploading) ? __('Uploading files...') : submitLabel}
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
        },
        mask: TOPIC_MODAL_MASK
      }}
      title={__('Create New Topic')}
      width={TOPIC_MODAL_WIDTH}
    >
      {isFormShown && <TopicForm form={form} taxonomies={taxonomies} />}
    </Modal>
  )
}
