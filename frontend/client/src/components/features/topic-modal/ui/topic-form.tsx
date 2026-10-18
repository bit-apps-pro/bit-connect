import NotifyContext from '@common/context/NotifyContext'
import { __ } from '@common/helpers/i18nWrap'
import { extractUploadError } from '@common/helpers/request'
import uploadAttachment from '@common/helpers/upload-attachment'
import { notificationOptions } from '@common/hooks/useNotificationConfig'
import { acceptsVideo, validateAttachment } from '@components/features/file-uploader/attachment-validation'
import QuillEditor from '@components/quilTextEditor'
import { resizeImageIfNeeded } from '@components/quilTextEditor/quill-image-resizer'
import config from '@config/config'
import FileUploader from '@features/file-uploader'
import useFileStore, { type WPAttachmentData } from '@features/file-uploader/state/use-file-store'
import FileList from '@features/file-uploader/ui/file-list'
import If from '@utilities/If'
import { slugify } from '@utils/slug'
import { type CheckboxChangeEvent, type FormInstance } from 'antd'
import { Checkbox, Form, Input, Select, Tooltip } from 'antd'
import { type ChangeEvent, useCallback, useContext, useMemo, useState } from 'react'

import { useAdminSettingsStore } from '@/store/admin-settings.zustand'
import { useAuthStore } from '@/store/auth.zustand'

import descriptionOptional from '../data/description-optional'
import useAddedTermFields from '../data/use-added-term-fields'
import useDestinationField from '../data/use-destination-field'
import { type TaxonomiesResponse } from '../data/use-taxonomies'
import useVisibilityOptions from '../data/use-visibility-options'
import { descriptionProblem } from '../shared/description-problem'
import { MAX_TAGS_PER_TOPIC } from '../shared/type'
import PermalinkField from './permalink-field'
import TopicFormExtras from './topic-form-extras'

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
  const { topicFormFields } = useAdminSettingsStore(s => s.settings)
  const { notificationApi } = useContext(NotifyContext)
  const [isSlugEdited, setIsSlugEdited] = useState(false)
  // Lives here rather than in the field: the Form.Item owns the label, and a
  // closed permalink should not put a "Permalink" heading on the modal.
  const [isPermalinkOpen, setIsPermalinkOpen] = useState(false)
  // The search title's placeholder names what a blank one falls back to.

  // An admin sets the topic type hidden, optional or required (Settings →
  // Topic form), and the row's layout depends on how many fields are shown. The
  // server enforces "required" as well — see CreateTopicRequest.
  const topicTypeMode = topicFormFields?.topicType ?? 'required'
  const showTopicType = topicTypeMode !== 'hidden'
  const addedTermFields = useAddedTermFields({ form, isEditMode: !!isEditMode })
  const destinationField = useDestinationField({ form, isEditMode: !!isEditMode })
  // A limit of zero takes the control away rather than leaving one that only
  // ever refuses. The server enforces the same numbers — see PostingLimits.php.
  const {
    attachments: maxAttachments,
    characters: maxLength,
    images: maxImages,
    videos: maxVideos
  } = config.POSTING_LIMITS.topic
  const canAddImage = maxImages > 0
  const canAddVideo = maxVideos > 0 && acceptsVideo()
  // Videos are counted apart from other files, so either may keep the control.
  const canAttach = maxAttachments > 0 || canAddVideo

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

  // Surface the reason instead of leaving the upload to vanish silently — the
  // server's own words when it gave any — then rethrow so the editor clears
  // its loading placeholder. A cancelled upload is what the member asked for
  // and is not reported.
  const reportUploadFailure = useCallback(
    (error_: unknown, signal?: AbortSignal) => {
      if (signal?.aborted) return
      notificationApi?.error({
        message: extractUploadError(error_),
        ...notificationOptions('error')
      })
    },
    [notificationApi]
  )

  const handleImageInsert = useCallback(
    async (
      file: File,
      insertImage: (url: string) => void,
      onProgress?: (n: number) => void,
      signal?: AbortSignal
    ) => {
      try {
        const { error, file: resized } = await resizeImageIfNeeded(file)
        if (error) throw new Error(error)

        // resizeImageIfNeeded only checks for an "image/" MIME prefix, which admits
        // types the server rejects (SVG, BMP, TIFF…). Apply the shared allowlist so
        // the error is immediate and names the actual problem.
        const validation = validateAttachment(resized)
        if (!validation.valid) throw new Error(validation.error)

        const response = await uploadAttachment<WPAttachmentData>(resized, { onProgress, signal })
        if (response.data.url) insertImage(response.data.url)
      } catch (error_) {
        reportUploadFailure(error_, signal)
        throw error_
      }
    },
    [reportUploadFailure]
  )

  // A video goes up as it is — there is no resizing a clip in the browser —
  // and is placed in the text where the caret was, like a picture. It counts
  // against the same videos limit as one attached below the post. A large one
  // is sent in pieces (uploadAttachment), so a slow connection or a proxy's
  // time limit does not lose the whole file.
  const handleVideoInsert = useCallback(
    async (
      file: File,
      insertVideo: (url: string) => void,
      onProgress?: (n: number) => void,
      signal?: AbortSignal
    ) => {
      try {
        const validation = validateAttachment(file)
        if (!validation.valid) throw new Error(validation.error)

        const response = await uploadAttachment<WPAttachmentData>(file, { onProgress, signal })
        if (response.data.url) insertVideo(response.data.url)
      } catch (error_) {
        reportUploadFailure(error_, signal)
        throw error_
      }
    },
    [reportUploadFailure]
  )

  const topicTypeOptions = useMemo(
    () =>
      taxonomies?.['bit-connect-topic-types']?.map(term => ({
        label: term.name,
        value: term.id
      })) || [],
    [taxonomies]
  )

  // A member allowed to suggest tags may type one that is not in the list.
  // It goes on the topic at once and waits for an administrator's approval
  // before it is offered to anyone else — see TagApprovalService.php. Without
  // the capability the control is the plain picker, not a picker that refuses.
  const canSuggestTags = useAuthStore(state => state.can('bit_connect_forum_create_tag'))

  const tagOptions = useMemo(
    () =>
      // Ids as strings: in tags mode antd makes a typed name a value of its own
      // and insists every value be a string. The server reads a digit string
      // as an id — see TagResolverService.
      taxonomies?.['bit-connect-tags']?.map(term => ({
        label: term.name,
        value: String(term.id)
      })) || [],
    [taxonomies]
  )

  // What this forum can make a topic. This plugin publishes topics and says so
  // with one option; the add-on's implementation knows about the rest. Passing
  // the topic's current status lets an implementation keep offering a choice
  // the topic is already using, so editing does not silently change it.
  //
  // Watched rather than read with getFieldValue(): this renders before the
  // <Form> below has mounted, and reading an unconnected form instance logged
  // antd's "not connected to any Form element" on every open.
  const postStatus = Form.useWatch('post_status', form) as string | undefined
  const visibilityOptions = useVisibilityOptions(postStatus)
  // The first is what a topic is unless the author says otherwise; a second,
  // when there is one, is the exception they opt into.
  const [usualVisibility, otherVisibility] = visibilityOptions
  const showVisibility = otherVisibility !== undefined
  const isOtherVisibility = postStatus === otherVisibility?.value && showVisibility

  return (
    // Field labels read as headings for their control, so they carry weight; antd
    // exposes no font-weight token for them, hence the one-off descendant rule.
    <Form
      className="[&_.ant-form-item-label>label]:bc-font-semibold"
      form={form}
      layout="vertical"
      // antd builds field ids from the form name. Unnamed, the create and edit
      // forms both render `#post_title`, and a label can reach the wrong input.
      name={isEditMode ? 'topic-edit' : 'topic-create'}
    >
      {/* Where the topic goes and who may read it, as one bar above the title:
          both are settled before the writing starts, and neither needs a row of
          its own. The bar wraps on a phone rather than squeezing the two. */}
      <div
        className={
          destinationField || showVisibility
            ? 'bc-mb-4 bc-flex bc-flex-wrap bc-items-center bc-justify-between bc-gap-3'
            : undefined
        }
      >
        {destinationField}

        {/* One box to tick rather than a choice between equals: almost every
            topic takes the usual visibility, and the other is the exception.
            Hidden rather than unrendered when there is nothing to opt into —
            the field still has to register `publish` so the payload is
            identical either way. Dropping the Form.Item entirely would leave
            post_status off the request and lean on the server's default. */}
        <Form.Item
          // A box on a line of text rides above the pill's centre by the line's
          // descender; as a flex item it is centred on the row like the pill.
          className="bc-mb-0 [&_.ant-form-item-control-input-content]:bc-flex"
          getValueFromEvent={(event: CheckboxChangeEvent) =>
            event.target.checked ? otherVisibility?.value : usualVisibility?.value
          }
          getValueProps={(value: string) => ({ checked: value === otherVisibility?.value })}
          hidden={!showVisibility}
          initialValue="publish"
          name="post_status"
        >
          <Checkbox
            // antd sits the box on the label's text baseline, a couple of pixels
            // low beside the 16px icon, so the two are centred on each other
            // instead. It also pads the label on the right for a following
            // control; at the end of the bar that would stop it short of the
            // fields' right edge.
            className="bc-items-center [&_.ant-checkbox+span]:bc-pe-0"
          >
            {/* Opens under the box and toward the form, not off the modal's edge. */}
            <Tooltip placement="bottomRight" title={otherVisibility?.description}>{otherVisibility?.label}</Tooltip>
          </Checkbox>
        </Form.Item>

        {/* Said in words once the box is ticked: a touch screen never shows
            the tooltip, and this is the one choice whose consequence the
            author must not miss. A row of its own under the bar. */}
        {isOtherVisibility && otherVisibility?.description && (
          <p className="bc-m-0 bc-basis-full bc-text-sm bc-text-ink-muted" role="status">
            {otherVisibility.description}
          </p>
        )}
      </div>

      {/* A closed permalink is a line of helper text, so it tucks under the
          title rather than standing off it as a field of its own. */}
      <Form.Item
        className={isPermalinkOpen ? 'bc-mb-4' : 'bc-mb-1'}
        label={__('Post title')}
        name="post_title"
        rules={[
          { message: __('Please enter a post title'), required: true },
          { max: 200, message: __('Post title cannot exceed 200 characters') }
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
          switch Topic Type off, and a lone field should take the whole row
          rather than sit at half width beside dead space. One column on phones
          regardless — side-by-side selects truncate their placeholders long
          before the modal is narrow enough to feel cramped. */}
      {(showTopicType || addedTermFields.length > 0) && (
        <div
          className={`bc-mb-4 bc-grid bc-grid-cols-1 bc-gap-4 ${
            Number(showTopicType) + addedTermFields.length > 1 ? 'sm:bc-grid-cols-2' : ''
          }`}
        >
          {showTopicType && (
            <Form.Item
              className="bc-mb-0"
              label={__('Topic')}
              name="topic-types"
              rules={[{ message: __('Please select a topic'), required: topicTypeMode === 'required' }]}
            >
              <Select
                allowClear={topicTypeMode === 'optional'}
                options={topicTypeOptions}
                placeholder={__('Select a Topic')}
              />
            </Form.Item>
          )}

          {addedTermFields}
        </div>
      )}

      {/* The validator rejects an empty body, so the field is required in practice —
          `required` only paints the asterisk so it matches the other required fields. */}
      <Form.Item
        className="bc-mb-4"
        label={__('Description')}
        name="post_content"
        required
        rules={[
          {
            validator: (_, value = '') => {
              const problem = descriptionProblem(value, {
                canAddImage,
                canAddVideo,
                maxLength,
                optional: descriptionOptional(form)
              })
              return problem ? Promise.reject(new Error(problem)) : Promise.resolve()
            }
          }
        ]}
      >
        <QuillEditor
          maxImages={maxImages}
          maxLength={maxLength}
          maxVideos={maxVideos}
          onChange={handleContentChange}
          onImageInsert={canAddImage ? handleImageInsert : undefined}
          onImagePaste={canAddImage ? handleImageInsert : undefined}
          // Only where the forum takes video files at all: the control would
          // otherwise open a picker that refuses everything.
          onVideoInsert={canAddVideo ? handleVideoInsert : undefined}
          placeholder={__('Write your post description...')}
          showHeadings={true}
          showToolbar={true}
        />
      </Form.Item>

      <TopicFormExtras form={form} isEditMode={!!isEditMode} topicId={topicId} />

      <Form.Item
        className="bc-mb-4"
        extra={
          canSuggestTags
            ? __('Not in the list? Type a new tag and press Enter. It is reviewed by a moderator before others can pick it.')
            : undefined
        }
        label={__('Tags')}
        name="tags"
      >
        {/* Options carry the term id as their value, and antd filters on the
            value unless told otherwise — typing a tag name would match nothing.
            In tags mode a typed name becomes a value of its own, a string
            beside the ids, and the server tells the two apart. */}
        <Select
          className="bc-w-full"
          maxCount={MAX_TAGS_PER_TOPIC}
          mode={canSuggestTags ? 'tags' : 'multiple'}
          optionFilterProp="label"
          options={tagOptions}
          placeholder={canSuggestTags ? __('Select or type tags…') : __('Select tags…')}
        />
      </Form.Item>

      <If conditions={canAttach || storedFiles.length > 0}>
        <div className="bc-mb-4">
          <If conditions={canAttach}>
            <FileUploader maxAttachments={maxAttachments} maxVideos={maxVideos} />
          </If>
          <If conditions={storedFiles && storedFiles.length > 0}>
            <FileList files={storedFiles} />
          </If>
        </div>
      </If>
    </Form>
  )
}
