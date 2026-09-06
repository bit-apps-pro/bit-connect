import { __ } from '@common/helpers/i18nWrap'
import useFileStore from '@features/file-uploader/state/use-file-store'
import { normalizeAttachments } from '@features/topic-modal/shared/type'
import { decodeSlug, slugRedirectPath } from '@utils/slug'
import { Button, Form, Modal } from 'antd'
import { useEffect, useRef } from 'react'
import { useLocation, useNavigate } from 'react-router'

import { useSinglePostStore } from '@/store/single-post.zustand'
import { useTaxonomiesStoreSelect } from '@/store/use-taxonomies-store'

import useUpdateTopic from '../data/use-update-topic'
import useTopicModalStore from '../state/use-topic-modal-store'
import TopicForm from './topic-form'

export default function TopicEditModal() {
  const [form] = Form.useForm()
  const { closeEditModal, editTopicId, isEditModalOpen } = useTopicModalStore()
  const { clearFiles, files, resetFiles, setFiles } = useFileStore()
  const taxonomies = useTaxonomiesStoreSelect()
  const { isUpdatingTopic, updateTopic } = useUpdateTopic(form)
  const { post, setPost } = useSinglePostStore()
  const populatedForId = useRef<null | number>(undefined)
  const navigate = useNavigate()
  const { pathname } = useLocation()

  useEffect(() => {
    if (!isEditModalOpen) return

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault()
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [isEditModalOpen])

  const handleClose = () => {
    const existingIds = normalizeAttachments(post?.attachments).map(a => a.id)
    populatedForId.current = undefined
    closeEditModal()
    form.resetFields()
    clearFiles(existingIds)
  }

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields()

      const hasUploading = files.some(f => f.isUploading)
      if (hasUploading) return

      const attachmentIds = files.filter(f => f.wp_id).map(f => f.wp_id as number)

      const payload = {
        ...values,
        attachments: attachmentIds,
        topic_id: editTopicId
      }

      const response = await updateTopic(payload)

      if (response?.data) {
        const previousSlug = post?.post_name ?? ''
        setPost(response.data)

        // Renaming the slug moves the topic's URL out from under the page.
        // Replace rather than push, so Back does not lead to the dead slug.
        const moved = slugRedirectPath(pathname, previousSlug, response.data.post_name ?? '')
        if (moved) navigate(moved, { replace: true })
      }

      populatedForId.current = undefined
      closeEditModal()
      form.resetFields()
      resetFiles()
    } catch {
      // validation or API errors are handled by the form/hook
    }
  }

  useEffect(() => {
    if (post && isEditModalOpen && populatedForId.current !== editTopicId) {
      populatedForId.current = editTopicId
      form.setFieldsValue({
        departments: post.terms?.departments?.term_id,
        post_content: post.post_content,
        // Stored percent-encoded for non-Latin slugs; show the readable form.
        post_name: decodeSlug(post.post_name ?? ''),
        post_status: post.post_status,
        post_title: post.post_title,
        tags: post.terms?.tags?.map(tag => tag.term_id) || [],
        'topic-types': post.terms?.topic_types?.term_id
      })
      const normalized = normalizeAttachments(post.attachments)
      if (normalized.length > 0) {
        const fileItems = normalized.map(att => ({
          file_id: `wp-${att.id}`,
          file_name: att.filename,
          file_size_in_bytes: att.filesize,
          file_url: att.url,
          mime: att.type,
          wp_id: att.id,
          wp_url: att.url
        }))
        setFiles(fileItems)
      }
    }
  }, [post, isEditModalOpen, editTopicId, form, setFiles])

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
            disabled={files.some(f => f.isUploading)}
            key="submit"
            onClick={handleSubmit}
            type="primary"
          >
            {files.some(f => f.isUploading) ? __('Uploading files...') : __('Update')}
          </Button>
        </div>
      }
      loading={isUpdatingTopic}
      onCancel={handleClose}
      onOk={handleSubmit}
      open={isEditModalOpen}
      styles={{
        body: {
          marginInline: '-22px',
          maxHeight: '70vh',
          overflowY: 'auto',
          paddingInline: '22px'
        }
      }}
      title={__('Edit Topic')}
    >
      {isEditModalOpen && (
        <TopicForm form={form} isEditMode taxonomies={taxonomies} topicId={editTopicId} />
      )}
    </Modal>
  )
}
