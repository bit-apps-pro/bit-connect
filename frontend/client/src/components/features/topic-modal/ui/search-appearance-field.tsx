import { __ } from '@common/helpers/i18nWrap'
import { uploadRequest } from '@common/helpers/request'
import { validateAttachment } from '@components/features/file-uploader/attachment-validation'
import { type WPAttachmentData } from '@features/file-uploader/state/use-file-store'
import { Button, Input } from 'antd'
import { type ChangeEvent, useCallback, useRef, useState } from 'react'
import { LuImage, LuSearch, LuX } from 'react-icons/lu'

import { BLANK_TOPIC_SEO, type TopicSeo } from '../shared/type'

/** Server-side caps, mirrored from TopicSeoService. */
export const SEO_TITLE_MAX = 200
export const SEO_DESCRIPTION_MAX = 320

/**
 * The image has to be something a preview bot can fetch on its own, which
 * rules out relative paths and anything that is not a web URL.
 */
export function isUsableImageUrl(url: string): boolean {
  return url === '' || /^https?:\/\/\S+$/i.test(url)
}

export function isSeoSet(seo?: Partial<TopicSeo>): boolean {
  return Boolean(seo?.title || seo?.description || seo?.image)
}

interface SearchAppearanceFieldProps {
  /** Form.Item hands this down; whatever carries it is what its label points at. */
  id?: string
  isOpen?: boolean
  /** antd wires these two — the field is a controlled Form.Item child. */
  onChange?: (value: TopicSeo) => void
  /** Owned by the form, which needs it to decide whether to render a label at all. */
  onOpenChange?: (isOpen: boolean) => void
  /** Blank means the search title falls back to this. */
  titleFallback?: string
  value?: TopicSeo
}

/**
 * How this topic asks to appear in search results and link previews.
 *
 * Out of the way until asked for, like the permalink: most authors should
 * never have to think about a meta description. The few whose question opens
 * with a vague sentence — and so gets a vague Google result — can write the
 * one they want here. Every field is optional and blank means "derive it from
 * the topic", which is what happens without this field at all.
 */
export default function SearchAppearanceField({
  id,
  isOpen,
  onChange,
  onOpenChange,
  titleFallback = '',
  value = BLANK_TOPIC_SEO
}: SearchAppearanceFieldProps) {
  const openedWith = useRef<TopicSeo>(BLANK_TOPIC_SEO)
  const fileInput = useRef<HTMLInputElement>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [uploadError, setUploadError] = useState('')

  const setField = useCallback(
    (key: keyof TopicSeo, next: string) => onChange?.({ ...value, [key]: next }),
    [onChange, value]
  )

  const handleOpen = useCallback(() => {
    openedWith.current = value
    onOpenChange?.(true)
  }, [onOpenChange, value])

  const handleCancel = useCallback(() => {
    onChange?.(openedWith.current)
    setUploadError('')
    onOpenChange?.(false)
  }, [onChange, onOpenChange])

  const handleDone = useCallback(() => {
    // The Form.Item's own rule is already saying what is wrong with the image;
    // collapsing here would hide the input that error points at.
    if (!isUsableImageUrl(value.image.trim())) return

    onChange?.({
      description: value.description.trim(),
      image: value.image.trim(),
      title: value.title.trim()
    })
    setUploadError('')
    onOpenChange?.(false)
  }, [onChange, onOpenChange, value])

  const handleUpload = useCallback(
    async (e: ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      // Same file twice in a row should upload twice; a stale value blocks that.
      if (fileInput.current) fileInput.current.value = ''
      if (!file) return

      const validation = validateAttachment(file)
      if (!validation.valid) {
        setUploadError(validation.error ?? __('This file cannot be used as an image'))
        return
      }

      setIsUploading(true)
      setUploadError('')
      try {
        const formData = new FormData()
        formData.append('file', file)
        const response = await uploadRequest<WPAttachmentData>('attachments', formData)
        if (response.data.url) setField('image', response.data.url)
      } catch (error) {
        setUploadError((error as { message?: string })?.message ?? __('Failed to upload image'))
      } finally {
        setIsUploading(false)
      }
    },
    [setField]
  )

  if (!isOpen) {
    const isSet = isSeoSet(value)

    return (
      <div className="bc-flex bc-flex-col bc-gap-0.5">
        {/* Sized and coloured as helper text, not as an action — see the
            permalink opener, which this sits a few fields below. */}
        <Button
          className="bc-h-auto bc-self-start bc-p-0 bc-text-xs bc-font-normal bc-text-ink-muted hover:bc-text-primary"
          icon={<LuSearch size={12} />}
          id={id}
          onClick={handleOpen}
          size="small"
          type="link"
        >
          {isSet ? __('Edit search appearance') : __('Customise search appearance')}
        </Button>
        {/* A customised topic says so while closed, so nobody has to open the
            section to learn that a title other than the topic's is in play. */}
        {isSet && (
          <span className="bc-truncate bc-text-xs bc-text-ink-subtle">
            {value.title || titleFallback}
            {value.description ? ` — ${value.description}` : ''}
          </span>
        )}
      </div>
    )
  }

  return (
    <div className="bc-flex bc-flex-col bc-gap-3">
      <span className="bc-text-xs bc-text-ink-subtle">
        {__(
          'What search engines and link previews show for this topic. Leave a field blank to use the topic itself.'
        )}
      </span>

      <div className="bc-flex bc-flex-col bc-gap-1">
        <label className="bc-text-xs bc-font-medium" htmlFor={`${id}-title`}>
          {__('Search title')}
        </label>
        <Input
          id={`${id}-title`}
          maxLength={SEO_TITLE_MAX}
          onChange={e => setField('title', e.target.value)}
          placeholder={titleFallback || __('The topic title')}
          showCount
          value={value.title}
        />
        <span className="bc-text-xs bc-text-ink-subtle">
          {__('Search engines show about 60 characters.')}
        </span>
      </div>

      <div className="bc-flex bc-flex-col bc-gap-1">
        <label className="bc-text-xs bc-font-medium" htmlFor={`${id}-description`}>
          {__('Search description')}
        </label>
        <Input.TextArea
          autoSize={{ maxRows: 4, minRows: 2 }}
          id={`${id}-description`}
          maxLength={SEO_DESCRIPTION_MAX}
          onChange={e => setField('description', e.target.value)}
          placeholder={__('The first lines of the topic')}
          showCount
          value={value.description}
        />
        <span className="bc-text-xs bc-text-ink-subtle">
          {__('Search engines show about 160 characters. One clear sentence beats a long one.')}
        </span>
      </div>

      <div className="bc-flex bc-flex-col bc-gap-1">
        <label className="bc-text-xs bc-font-medium" htmlFor={`${id}-image`}>
          {__('Preview image')}
        </label>
        <div className="bc-flex bc-gap-2">
          <Input
            id={`${id}-image`}
            onChange={e => setField('image', e.target.value)}
            placeholder={__('https://…')}
            value={value.image}
          />
          <Button
            icon={<LuImage size={14} />}
            loading={isUploading}
            onClick={() => fileInput.current?.click()}
          >
            {__('Upload')}
          </Button>
          {value.image && (
            <Button
              aria-label={__('Remove preview image')}
              icon={<LuX size={14} />}
              onClick={() => setField('image', '')}
            />
          )}
        </div>
        <input
          accept="image/*"
          aria-label={__('Upload preview image')}
          className="bc-hidden"
          onChange={handleUpload}
          ref={fileInput}
          type="file"
        />
        {uploadError ? (
          <span className="bc-text-xs bc-text-negative">{uploadError}</span>
        ) : (
          <span className="bc-text-xs bc-text-ink-subtle">
            {__('Shown on social cards. Without one, the topic image or community logo is used.')}
          </span>
        )}
        {value.image && isUsableImageUrl(value.image.trim()) && (
          <img
            alt=""
            className="bc-mt-1 bc-max-h-24 bc-w-auto bc-rounded-md bc-border bc-border-solid bc-border-line bc-object-cover"
            src={value.image.trim()}
          />
        )}
      </div>

      <div className="bc-mt-0.5 bc-flex bc-justify-end bc-gap-2">
        <Button onClick={handleCancel} size="small">
          {__('Cancel')}
        </Button>
        <Button onClick={handleDone} size="small" type="primary">
          {__('Done')}
        </Button>
      </div>
    </div>
  )
}
