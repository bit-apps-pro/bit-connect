import NotifyContext from '@common/context/NotifyContext'
import { __ } from '@common/helpers/i18nWrap'
import { uploadRequest } from '@common/helpers/request'
import { notificationOptions } from '@common/hooks/useNotificationConfig'
import { validateAttachment } from '@components/features/file-uploader/attachment-validation'
import QuillEditor from '@components/quilTextEditor'
import { resizeImageIfNeeded } from '@components/quilTextEditor/quill-image-resizer'
import FileUploader from '@features/file-uploader'
import useFileStore, { type WPAttachmentData } from '@features/file-uploader/state/use-file-store'
import FileList from '@features/file-uploader/ui/file-list'
import If from '@utilities/If'
import { slugify } from '@utils/slug'
import { type FormInstance } from 'antd'
import { Form, Input, Radio, Select } from 'antd'
import { type ChangeEvent, useCallback, useContext, useMemo, useState } from 'react'
import { LuGlobe, LuLock } from 'react-icons/lu'

import { useAdminSettingsStore } from '@/store/admin-settings.zustand'

import { type TaxonomiesResponse } from '../data/use-taxonomies'
import PermalinkField from './permalink-field'

const stripHtml = (html: string) =>
  html
    .replaceAll(/<[^>]*>/g, '')
    .replaceAll(/&nbsp;/gi, ' ')
    .trim()

export default function TopicForm({
  form,
  isEditMode,
  taxonomies,
  topicId
}: {
  form: FormInstance
  isEditMode?: boolean
  taxonomies?: TaxonomiesResponse
  /** The topic being edited, so the slug check does not read its own slug as taken. */
  topicId?: number
}) {
  const { files: storedFiles } = useFileStore()
  const { topicAccess, topicFormFields } = useAdminSettingsStore(s => s.settings)
  const { notificationApi } = useContext(NotifyContext)
  const [isSlugEdited, setIsSlugEdited] = useState(false)
  // Lives here rather than in the field: the Form.Item owns the label, and a
  // closed permalink should not put a "Permalink" heading on the modal.
  const [isPermalinkOpen, setIsPermalinkOpen] = useState(false)

  // Either taxonomy can be switched off by an admin, and the row's layout
  // depends on how many survive.
  const showTopicType = Boolean(topicFormFields?.requireTopicType)
  const showDepartment = Boolean(topicFormFields?.requireDepartment)

  // Both modals mount this form only while they are open, so the flag starts
  // false on every open without needing to watch the modal itself.
  const handleTitleChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      // A published topic keeps the permalink it already has — WordPress does
      // not re-slug on a title edit either. Only a new topic's slug follows
      // along, and only until the author takes it over.
      if (isEditMode || isSlugEdited) return
      form.setFieldValue('post_name', slugify(e.target.value))
    },
    [form, isEditMode, isSlugEdited]
  )

  const handleSlugChange = useCallback(() => setIsSlugEdited(true), [])

  const handleContentChange = useCallback(
    (html: string) => {
      form.setFieldsValue({ post_content: html })
    },
    [form]
  )

  const handleImageInsert = useCallback(
    async (file: File, insertImage: (url: string) => void, onProgress?: (n: number) => void) => {
      try {
        const { error, file: resized } = await resizeImageIfNeeded(file)
        if (error) throw new Error(error)

        // resizeImageIfNeeded only checks for an "image/" MIME prefix, which admits
        // types the server rejects (SVG, BMP, TIFF…). Apply the shared allowlist so
        // the error is immediate and names the actual problem.
        const validation = validateAttachment(resized)
        if (!validation.valid) throw new Error(validation.error)

        const formData = new FormData()
        formData.append('file', resized)
        const response = await uploadRequest<WPAttachmentData>('attachments', formData, {
          onProgress
        })
        if (response.data.url) insertImage(response.data.url)
      } catch (error_) {
        // Surface the reason instead of leaving the image to vanish silently,
        // then rethrow so the editor clears its loading placeholder.
        notificationApi?.error({
          message: (error_ as { message?: string })?.message ?? __('Failed to upload image'),
          ...notificationOptions('error')
        })
        throw error_
      }
    },
    [notificationApi]
  )

  const topicTypeOptions = useMemo(
    () =>
      taxonomies?.['bit-connect-topic-types']?.map(term => ({
        label: term.name,
        value: term.id
      })) || [],
    [taxonomies]
  )

  const departmentOptions = useMemo(
    () =>
      taxonomies?.['bit-connect-departments']?.map(term => ({
        label: term.name,
        value: term.id
      })) || [],
    [taxonomies]
  )

  const tagOptions = useMemo(
    () =>
      taxonomies?.['bit-connect-tags']?.map(term => ({
        label: term.name,
        value: term.id
      })) || [],
    [taxonomies]
  )

  // Private topics are a Pro feature the admin also has to switch on, and the
  // server reports that combined answer in `topicAccess.privateTopic`. It is
  // still offered while editing a topic that is already private: the server
  // refuses only a *move* into private, so hiding the option there would leave
  // the radio with nothing selected and quietly publish the topic on save.
  const visibilityOptions = useMemo(() => {
    const options = [
      {
        label: (
          <div className="bc-flex bc-items-center bc-gap-2">
            <LuGlobe size={16} />
            {__('Public Topic')}
          </div>
        ),
        value: 'publish'
      }
    ]

    const isAlreadyPrivate = form.getFieldValue('post_status') === 'private'

    if (topicAccess?.privateTopic || isAlreadyPrivate) {
      options.push({
        label: (
          <div className="bc-flex bc-items-center bc-gap-2">
            <LuLock size={16} />
            {__('Private Topic')}
          </div>
        ),
        value: 'private'
      })
    }

    return options
  }, [topicAccess?.privateTopic, form])

  return (
    // Field labels read as headings for their control, so they carry weight; antd
    // exposes no font-weight token for them, hence the one-off descendant rule.
    <Form className="[&_.ant-form-item-label>label]:bc-font-semibold" form={form} layout="vertical">
      {/* Hidden rather than unrendered when only one visibility is on offer: a
          radio group of one is a control with nothing to decide, but the field
          still has to register `publish` so the payload is identical either way.
          Dropping the Form.Item entirely would leave post_status off the request
          and lean on the server's default instead. */}
      <Form.Item
        className="bc-mb-4"
        hidden={visibilityOptions.length < 2}
        initialValue="publish"
        name="post_status"
      >
        <Radio.Group
          // antd aligns the radio dot to the label's text baseline, which sits it a
          // couple of pixels high next to the 16px icon. Center it against the row.
          className="[&_.ant-radio-wrapper]:bc-items-center"
          options={visibilityOptions}
        />
      </Form.Item>

      {/* A closed permalink is a line of helper text, so it tucks under the
          title rather than standing off it as a field of its own. */}
      <Form.Item
        className={isPermalinkOpen ? 'bc-mb-4' : 'bc-mb-1'}
        label={__('Topic Title')}
        name="post_title"
        rules={[
          { message: __('Please enter a topic title'), required: true },
          { max: 200, message: __('Topic title cannot exceed 200 characters') }
        ]}
      >
        <Input maxLength={200} onChange={handleTitleChange} placeholder={__('Write a post title')} />
      </Form.Item>

      {/* The slug is a power-user control: nothing but a link to open it until
          someone asks. The label only exists while it is open, so a closed
          field costs a single line — see permalink-field.tsx. */}
      <Form.Item
        className="bc-mb-4"
        label={isPermalinkOpen ? __('Permalink') : undefined}
        name="post_name"
        rules={[
          { max: 200, message: __('Slug cannot exceed 200 characters') },
          {
            validator: (_, value = '') => {
              // Blank is allowed — the server derives one from the title. What
              // is rejected is input that slugifies to nothing at all, which
              // would silently do the same thing behind the author's back.
              if (value && !slugify(value)) {
                return Promise.reject(new Error(__('Slug must contain at least one letter or number')))
              }
              return Promise.resolve()
            }
          }
        ]}
      >
        <PermalinkField
          isEditMode={isEditMode}
          isOpen={isPermalinkOpen}
          onOpenChange={setIsPermalinkOpen}
          onUserEdit={handleSlugChange}
          topicId={topicId}
        />
      </Form.Item>

      {/* Two columns only when there are two fields to fill them: an admin can
          switch either off, and the survivor should take the whole row rather
          than sit at half width beside dead space. One column on phones
          regardless — side-by-side selects truncate their placeholders long
          before the modal is narrow enough to feel cramped. */}
      {(showTopicType || showDepartment) && (
        <div
          className={`bc-mb-4 bc-grid bc-grid-cols-1 bc-gap-4 ${
            showTopicType && showDepartment ? 'sm:bc-grid-cols-2' : ''
          }`}
        >
          {showTopicType && (
            <Form.Item
              className="bc-mb-0"
              label={__('Topic Type')}
              name="topic-types"
              rules={[{ message: __('Please select a topic type'), required: true }]}
            >
              <Select options={topicTypeOptions} placeholder={__('Select a Topic Type')} />
            </Form.Item>
          )}

          {showDepartment && (
            <Form.Item
              className="bc-mb-0"
              label={__('Products/Department')}
              name="departments"
              rules={[{ message: __('Please select a department'), required: true }]}
            >
              <Select options={departmentOptions} placeholder={__('All Products/Department')} />
            </Form.Item>
          )}
        </div>
      )}

      {/* The validator rejects an empty body, so the field is required in practice —
          `required` only paints the asterisk so it matches the other required fields. */}
      <Form.Item
        className="bc-mb-4"
        label={__('Write Your Topic Description Here')}
        name="post_content"
        required
        rules={[
          {
            validator: (_, value = '') => {
              const html = value
              const text = stripHtml(html)
              // An image on its own is a valid description — a screenshot often
              // says more than the paragraph describing it.
              if (!text && !/<img\b/i.test(html)) {
                return Promise.reject(new Error(__('Please enter a description or add an image')))
              }
              if (text.length > 10_000) {
                return Promise.reject(new Error(__('Description cannot exceed 10000 characters')))
              }
              return Promise.resolve()
            }
          }
        ]}
      >
        <QuillEditor
          onChange={handleContentChange}
          onImageInsert={handleImageInsert}
          onImagePaste={handleImageInsert}
          placeholder={__('Write your topic description...')}
          showHeadings={true}
          showToolbar={true}
        />
      </Form.Item>

      <Form.Item className="bc-mb-4" label={__('Tag')} name="tags">
        {/* Options carry the term id as their value, and antd filters on the
            value unless told otherwise — typing a tag name would match nothing. */}
        <Select
          className="bc-w-full"
          mode="multiple"
          optionFilterProp="label"
          options={tagOptions}
          placeholder={__('Select tags..')}
        />
      </Form.Item>

      <div className="bc-mb-4">
        <FileUploader />
        <If conditions={storedFiles && storedFiles.length > 0}>
          <FileList files={storedFiles} />
        </If>
      </div>
    </Form>
  )
}
