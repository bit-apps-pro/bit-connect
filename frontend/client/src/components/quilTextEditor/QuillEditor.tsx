import {
  BoldOutlined,
  CheckOutlined,
  CloseOutlined,
  CodeOutlined,
  EllipsisOutlined,
  ItalicOutlined,
  LinkOutlined,
  OrderedListOutlined,
  PaperClipOutlined,
  PictureOutlined,
  UnderlineOutlined,
  UnorderedListOutlined,
  VideoCameraAddOutlined,
  WarningOutlined
} from '@ant-design/icons'
import { __ } from '@common/helpers/i18nWrap'
import { extractUploadError } from '@common/helpers/request'
import { acceptMimeTypes } from '@features/file-uploader/attachment-validation'
import { theme as antdTheme, Button, Flex, Input, Popover, Select, Tooltip, Typography } from 'antd'
import Quill from 'quill'
import {
  memo,
  type ReactNode,
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState
} from 'react'
import 'quill/dist/quill.snow.css'

// Side-effect imports: register custom Quill modules/blots
import './quill-clipboard-sanitizer'
import './quill-mention'
import useEditorExtras from './editor-extras'
import { searchMembers } from './mention-source'
import { isEmojiSource } from './quill-emoji'
import { setImageLoadingProgress, setUploadLabel } from './quill-image-loading-blot'
import { countCharacters, validateContent, type ValidationResult } from './quill-validation'
import { unwrapVideoFigures } from './quill-video-file'
import { formatForWordPress } from './quill-wp-formatter'
import styles from './QuillEditor.module.css'
import useOutsideDismiss from './use-outside-dismiss'

/**
 * Uploads `file` and calls `insertMedia` with the resulting URL. `onProgress`
 * is optional — handlers that can report upload progress should call it with
 * 0–100 so the inline placeholder shows how far along the upload is.
 */
type MediaHandler = (
  file: File,
  insertMedia: (url: string) => void,
  onProgress?: (percent: number) => void,
  /** Aborted when the member cancels the upload or the editor goes away. */
  signal?: AbortSignal
) => Promise<void> | void

/** What an upload becomes in the text: a picture, or a video played in place. */
type MediaKind = 'image' | 'video'

/**
 * How each kind is placed: the blot the finished upload becomes, and the
 * prefix the placeholder's id carries while it is still uploading — one
 * placeholder blot serves both, so the prefix is what tells them apart.
 */
const MEDIA = {
  image: { blot: 'image', loadingPrefix: 'ql-img-' },
  video: { blot: 'video-file', loadingPrefix: 'ql-vid-' }
} as const

/**
 * Whether there is anything worth submitting.
 *
 * A picture on its own is a legitimate comment — a screenshot of the bug, a
 * photo of the receipt — so an embedded image counts even with no text, and
 * so does a video. The loading placeholder deliberately does not: submitting
 * mid-upload would post a comment whose image never arrives.
 */
function hasSubmittableContent(quill: Quill): boolean {
  if (quill.getText().trim().length > 0) return true

  return quill
    .getContents()
    .ops.some(
      op => typeof op.insert === 'object' && ('image' in (op.insert as object) || 'video-file' in (op.insert as object))
    )
}

/**
 * Media of one kind in the text, finished or still uploading. Both count
 * toward the limit: leaving the placeholders out would let a burst of pastes
 * past it. Emoji sprites WordPress swapped in are characters, not pictures,
 * and are saved as such — see quill-emoji.ts.
 */
function countMedia(quill: Quill, kind: MediaKind): number {
  const { blot, loadingPrefix } = MEDIA[kind]
  return quill
    .getContents()
    .ops.filter(op => {
      if (typeof op.insert !== 'object' || op.insert === null) return false
      const loading = (op.insert as { 'image-loading'?: unknown })['image-loading']
      if (typeof loading === 'string') return loading.startsWith(loadingPrefix)
      const url = (op.insert as Record<string, unknown>)[blot]
      return typeof url === 'string' && !(kind === 'image' && isEmojiSource(url))
    }).length
}

/** The limit's refusal, before anything is uploaded. */
function limitMessage(kind: MediaKind, max: number): string {
  if (kind === 'video') {
    return max === 1
      ? __('You can add only one video here.')
      : __('You can add up to %d videos here.').replace('%d', String(max))
  }
  return max === 1
    ? __('You can add only one image here.')
    : __('You can add up to %d images here.').replace('%d', String(max))
}

/**
 * A failed image upload must never be silent: the placeholder disappears and,
 * without a message, the button just looks broken.
 *
 * Callers also surface these (the portal shows a toast), so this can duplicate
 * the message. That is deliberate — the editor cannot know whether the caller
 * actually reported anything, and a caller wired up without a notification
 * context would otherwise fail invisibly. A message twice beats none.
 */
function reportImageError(error: unknown, showInline: (message: string) => void) {
  console.error('Upload failed:', error)
  // An upload refusal arrives as the server's envelope, not an Error.
  showInline(extractUploadError(error))
}

/**
 * Counts the image uploads still in flight for one editor.
 *
 * Submitting during an upload used to lose the picture outright: the editor is
 * cleared (or, when editing a comment, unmounted) the moment the draft is sent,
 * so the placeholder the finished upload looks for is gone and the image is
 * dropped on the floor. The count is what lets the submit button wait.
 *
 * It also holds a way to stop each upload, by the id of its placeholder:
 * clicking the placeholder, deleting it, or closing the editor cancels the
 * upload rather than leaving it to finish for nobody.
 */
interface UploadTracker {
  begin: () => void
  controllers: Map<string, AbortController>
  end: () => void
}

/**
 * Insert a loading placeholder at the cursor, call the upload handler while
 * feeding progress back into that placeholder, then swap in the real picture
 * or video (or remove the placeholder on error).
 */
function triggerMediaUpload(
  quill: Quill,
  file: File,
  kind: MediaKind,
  handler: MediaHandler,
  onError: (err: unknown) => void,
  track: UploadTracker,
  max?: number
) {
  // Refused before anything is uploaded. The server refuses the save as well,
  // but finding out then would cost the member the upload and the wait.
  if (max !== undefined && countMedia(quill, kind) >= max) {
    onError(new Error(limitMessage(kind, max)))
    return
  }

  const { blot, loadingPrefix } = MEDIA[kind]
  const loadingId = `${loadingPrefix}${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
  const range = quill.getSelection(true)
  quill.insertEmbed(range.index, 'image-loading', loadingId, 'user')
  quill.setSelection(range.index + 1, 0, 'user')
  if (kind === 'video') setUploadLabel(quill.root, loadingId, __('Uploading video…'))

  const findIdx = (): number => {
    let i = 0
    for (const op of quill.getContents().ops) {
      if (
        typeof op.insert === 'object' &&
        (op.insert as Record<string, unknown>)?.['image-loading'] === loadingId
      )
        return i
      i += typeof op.insert === 'string' ? op.insert.length : 1
    }
    return -1
  }

  const controller = new AbortController()

  const insertFunction = (url: string) => {
    // Done: taking the placeholder out below must not read as a cancel.
    track.controllers.delete(loadingId)
    const idx = findIdx()
    if (idx >= 0) {
      quill.deleteText(idx, 1, 'user')
      quill.insertEmbed(idx, blot, url, 'user')
      quill.setSelection(idx + 1, 0, 'user')
    }
  }

  const reportProgress = (percent: number) => setImageLoadingProgress(quill.root, loadingId, percent)

  track.controllers.set(loadingId, controller)
  track.begin()
  Promise.resolve(handler(file, insertFunction, reportProgress, controller.signal))
    .catch((error: unknown) => {
      const idx = findIdx()
      if (idx >= 0) quill.deleteText(idx, 1, 'user')
      // A cancel is what the member asked for, not something to report.
      if (!controller.signal.aborted) onError(error)
    })
    .finally(() => {
      track.controllers.delete(loadingId)
      track.end()
    })
}

/**
 * Block formats offered by the toolbar's text-format select.
 *
 * The body starts at h2 on purpose: the topic title is already the page's one
 * h1 (see PostHeader), so a second one in the description would compete with it
 * for the document outline.
 */
const HEADING_LEVELS: ReadonlySet<number> = new Set([2, 3, 4])

/** `header` value meaning "plain paragraph". Quill stores no level for those. */
const NO_HEADING = 0

/** `list` value meaning "not a list item". Quill reports no value for those. */
const NO_LIST = ''

/** Share of maxLength at which the character counter appears. */
const COUNTER_THRESHOLD = 0.8

/** Fixed so the control does not resize as the selected level changes. */
const HEADING_SELECT_WIDTH = 'bc-w-[124px]'

/** In the overflow menu it spans the row, like every other item there. */
const HEADING_SELECT_MENU_WIDTH = 'bc-w-full'

interface QuillEditorProps {
  className?: string
  defaultValue?: string
  /** Most images the text may hold. Unset is no limit; to allow none, leave
   *  out the image handlers instead, which removes the control. */
  maxImages?: number
  /** Most characters the text may hold, checked on submit. Unset is no limit. */
  maxLength?: number
  /** Most videos the text may hold. Unset is no limit; to allow none, leave
   *  out `onVideoInsert` instead, which removes the control. */
  maxVideos?: number
  /** Opt-out: typing "@" offers the member list. On everywhere the portal
   *  composes forum content, because a mention is how you bring a colleague
   *  into a thread — an editor without it leaves the notification with no way
   *  to be raised. Off is for editors whose text is not a conversation. */
  mentions?: boolean
  onAttachment?: (file: File) => void
  onChange?: (html: string) => void
  onImageInsert?: MediaHandler
  onImagePaste?: MediaHandler
  onSubmit?: (html: string) => void
  /** Uploads a video to play where it is placed in the text, as a picture
   *  is placed. Given only where the forum takes video files at all. */
  onVideoInsert?: MediaHandler
  placeholder?: string
  /** Opt-in: adds the paragraph/heading select to the toolbar. Off by default
   *  because comments are stripped of headings server-side
   *  (CommentSanitizerService), so offering the control there would silently
   *  discard what the author picked. */
  showHeadings?: boolean
  showToolbar?: boolean
  submitButtonText?: string
  /** When set, the submit button shows this icon only on mobile (<md), keeping
   *  the text label on desktop. Used to compact the comment "send" button. */
  submitIconMobile?: ReactNode
  theme?: 'bubble' | 'snow'
  value?: string
}

interface FormatState {
  bold: boolean
  /** True when the caret sits inside a code block. */
  codeBlock: boolean
  /** Heading level at the caret, or NO_HEADING for a paragraph. */
  header: number
  italic: boolean
  link: boolean
  /** Quill's list value at the caret — 'bullet', 'ordered', or NO_LIST. */
  list: string
  underline: boolean
}

function QuillEditorInner({
  className,
  defaultValue,
  maxImages,
  maxLength,
  maxVideos,
  mentions = true,
  onAttachment,
  onChange,
  onImageInsert,
  onImagePaste,
  onSubmit,
  onVideoInsert,
  placeholder,
  showHeadings = false,
  showToolbar = true,
  submitButtonText = 'Comment',
  submitIconMobile,
  theme = 'snow',
  value
}: QuillEditorProps) {
  const { token } = antdTheme.useToken()
  const headingSelectId = useId()
  const containerRef = useRef<HTMLDivElement>(null)
  const editorRef = useRef<Quill | undefined>(undefined)
  const defaultValueRef = useRef(defaultValue)
  const onChangeRef = useRef(onChange)
  const onSubmitRef = useRef(onSubmit)
  const onImagePasteRef = useRef(onImagePaste)
  const onImageInsertRef = useRef(onImageInsert)
  const onVideoInsertRef = useRef(onVideoInsert)
  const maxImagesRef = useRef(maxImages)
  const maxVideosRef = useRef(maxVideos)
  const [characterCount, setCharacterCount] = useState(0)
  const savedSelectionRef = useRef<null | { index: number; length: number }>(null)
  const contentRef = useRef('')
  const isInternalChange = useRef(false)
  const [hasContent, setHasContent] = useState(false)
  const [uploadsInFlight, setUploadsInFlight] = useState(0)
  const [validationErrors, setValidationErrors] = useState<string[]>([])
  const [linkPopoverOpen, setLinkPopoverOpen] = useState(false)
  const [moreOpen, setMoreOpen] = useState(false)
  /** The overflow menu holds its own copy of the heading select, so the label
   *  in there needs an id that does not collide with the toolbar's. */
  const menuHeadingSelectId = useId()
  const [linkInputValue, setLinkInputValue] = useState('')
  const linkInputRef = useRef('')
  const linkButtonRef = useRef<HTMLButtonElement>(null)
  const linkPopoverRef = useRef<HTMLDivElement>(null)
  const linkPopoverParts = useMemo(() => [linkButtonRef, linkPopoverRef], [])
  const extras = useEditorExtras()
  // Read from inside Quill's listeners, which are bound once at mount.
  const extrasRef = useRef(extras)
  const [formatState, setFormatState] = useState<FormatState>({
    bold: false,
    codeBlock: false,
    header: NO_HEADING,
    italic: false,
    link: false,
    list: NO_LIST,
    underline: false
  })

  // Stable across renders: the paste listener is bound once, inside the mount
  // effect, and has to reach the same counter the toolbar button does.
  const uploadTracker = useRef<UploadTracker>({
    begin: () => setUploadsInFlight(n => n + 1),
    controllers: new Map(),
    end: () => setUploadsInFlight(n => Math.max(0, n - 1))
  }).current

  const headingOptions = useMemo(
    () => [
      { label: __('Normal text'), value: NO_HEADING },
      { label: __('Heading'), value: 2 },
      { label: __('Subheading'), value: 3 },
      { label: __('Small heading'), value: 4 }
    ],
    []
  )

  // h1/h5/h6 can still arrive by paste. They are left alone in the document —
  // the select just falls back to the paragraph label rather than showing a
  // level it cannot apply.
  const selectedHeading = HEADING_LEVELS.has(formatState.header) ? formatState.header : NO_HEADING

  useLayoutEffect(() => {
    onChangeRef.current = onChange
    onSubmitRef.current = onSubmit
    onImagePasteRef.current = onImagePaste
    onImageInsertRef.current = onImageInsert
    onVideoInsertRef.current = onVideoInsert
    maxImagesRef.current = maxImages
    maxVideosRef.current = maxVideos
    extrasRef.current = extras
  })

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    // eslint-disable-next-line unicorn/prefer-dom-node-append
    const editorContainer = container.appendChild(container.ownerDocument.createElement('div'))
    editorContainer.className = styles.quillEditorContainer

    const quill = new Quill(editorContainer, {
      modules: {
        toolbar: false,
        // Registered via side-effect import of quill-clipboard-sanitizer.ts
        clipboardSanitizer: true,
        // Registered via side-effect import of quill-mention.ts. `false` is how
        // a Quill module is left out entirely; passing the search function is
        // what turns the picker on, so an editor with mentions off never asks
        // the member endpoint at all.
        mention: mentions ? { search: searchMembers } : false
      },
      placeholder,
      theme
    })

    editorRef.current = quill

    if (defaultValueRef.current) {
      quill.setContents(quill.clipboard.convert({ html: unwrapVideoFigures(defaultValueRef.current) }))
    }
    extrasRef.current.onUpdate?.(quill)

    const updateFormatState = () => {
      const selection = quill.getSelection()
      if (selection) {
        const formats = quill.getFormat(selection)
        const newBold = Boolean(formats.bold)
        const newCodeBlock = Boolean(formats['code-block'])
        const newItalic = Boolean(formats.italic)
        const newLink = Boolean(formats.link)
        const newUnderline = Boolean(formats.underline)
        // A selection spanning a heading and a paragraph reports no single
        // level, which reads as a paragraph here — the same thing the user
        // sees if they then pick a format.
        const newHeader = typeof formats.header === 'number' ? formats.header : NO_HEADING
        // Likewise for a selection covering both a bullet and a numbered item:
        // Quill hands back an array, and neither button should look active.
        const newList = typeof formats.list === 'string' ? formats.list : NO_LIST

        setFormatState(prev => {
          if (
            prev.bold === newBold &&
            prev.codeBlock === newCodeBlock &&
            prev.header === newHeader &&
            prev.italic === newItalic &&
            prev.link === newLink &&
            prev.list === newList &&
            prev.underline === newUnderline
          ) {
            return prev
          }
          return {
            bold: newBold,
            codeBlock: newCodeBlock,
            header: newHeader,
            italic: newItalic,
            link: newLink,
            list: newList,
            underline: newUnderline
          }
        })
      }
    }

    quill.on(Quill.events.TEXT_CHANGE, () => {
      extrasRef.current.onUpdate?.(quill)

      // A placeholder deleted with the text around it — backspace, a cut, an
      // undo — cancels its upload: nothing is left for the file to fill.
      for (const [loadingId, controller] of uploadTracker.controllers) {
        if (!quill.root.querySelector(`[data-loading-id="${CSS.escape(loadingId)}"]`)) controller.abort()
      }

      // Format immediately so the value stored in state and passed to onChange
      // is already WordPress-compatible HTML — no further transformation needed
      // at submit time or on the backend read path.
      const html = formatForWordPress(quill.getSemanticHTML())
      contentRef.current = html

      const newHasContent = hasSubmittableContent(quill)
      setHasContent(prev => (prev === newHasContent ? prev : newHasContent))
      setCharacterCount(countCharacters(html))

      // Clear errors as the user types so they don't persist stale messages
      setValidationErrors([])

      if (!isInternalChange.current) {
        onChangeRef.current?.(html)
      }
      updateFormatState()
    })

    quill.on(Quill.events.SELECTION_CHANGE, (range: null | { index: number; length: number }) => {
      if (range) {
        savedSelectionRef.current = range
      }
      updateFormatState()
      extrasRef.current.onUpdate?.(quill)
    })

    // Listen for paste rejections dispatched by ClipboardSanitizerModule
    const handlePasteRejected = (e: Event) => {
      const detail = (e as CustomEvent<{ reason: string }>).detail
      setValidationErrors([detail.reason])
    }
    quill.root.addEventListener('quill-paste-rejected', handlePasteRejected)

    const handleImagePaste = (e: Event) => {
      const { file } = (e as CustomEvent<{ file: File }>).detail
      if (!onImagePasteRef.current) return
      triggerMediaUpload(
        quill,
        file,
        'image',
        onImagePasteRef.current,
        error => reportImageError(error, message => setValidationErrors([message])),
        uploadTracker,
        maxImagesRef.current
      )
    }
    quill.root.addEventListener('quill-image-paste', handleImagePaste)

    // Prevent Quill from embedding dropped image files as base64 data URIs.
    // Captured in the capture phase so it runs before Quill's own drop handler.
    const handleDrop = (e: DragEvent) => {
      const hasImage = [...(e.dataTransfer?.items ?? [])].some(item => item.type.startsWith('image/'))
      if (hasImage) {
        e.preventDefault()
        e.stopPropagation()
      }
    }
    quill.root.addEventListener('drop', handleDrop, true)

    // Floating delete button shown when hovering over an inline image or video
    const deleteBtn = document.createElement('button')
    deleteBtn.className = styles.imageDeleteBtn
    deleteBtn.setAttribute('type', 'button')
    deleteBtn.setAttribute('aria-label', 'Remove image')
    deleteBtn.innerHTML =
      '<svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>'
    document.body.append(deleteBtn)

    let hoveredMedia: HTMLImageElement | HTMLVideoElement | undefined

    const showDeleteBtn = (media: HTMLImageElement | HTMLVideoElement) => {
      hoveredMedia = media
      const rect = media.getBoundingClientRect()
      deleteBtn.setAttribute('aria-label', media.tagName === 'VIDEO' ? 'Remove video' : 'Remove image')
      deleteBtn.style.display = 'flex'
      deleteBtn.style.top = `${rect.top + 6}px`
      deleteBtn.style.left = `${rect.right - 30}px`
    }

    const hideDeleteBtn = () => {
      hoveredMedia = undefined
      deleteBtn.style.display = 'none'
    }

    const handleMouseOver = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      if (target.tagName === 'IMG' || target.tagName === 'VIDEO') {
        showDeleteBtn(target as HTMLImageElement | HTMLVideoElement)
      }
    }

    const handleMouseLeave = (e: MouseEvent) => {
      if ((e.relatedTarget as Node) === deleteBtn) return
      hideDeleteBtn()
    }

    const handleDeleteBtnMouseLeave = (e: MouseEvent) => {
      if (quill.root.contains(e.relatedTarget as Node)) return
      hideDeleteBtn()
    }

    const handleDeleteClick = () => {
      if (!hoveredMedia) return
      const source = hoveredMedia.getAttribute('src')
      const blot = hoveredMedia.tagName === 'VIDEO' ? MEDIA.video.blot : MEDIA.image.blot
      if (source) {
        let i = 0
        for (const op of quill.getContents().ops) {
          if (typeof op.insert === 'object' && (op.insert as Record<string, unknown>)[blot] === source) {
            quill.deleteText(i, 1, 'user')
            break
          }
          i += typeof op.insert === 'string' ? op.insert.length : 1
        }
      }
      hideDeleteBtn()
    }

    quill.root.addEventListener('mouseover', handleMouseOver)
    quill.root.addEventListener('mouseleave', handleMouseLeave)
    deleteBtn.addEventListener('mouseleave', handleDeleteBtnMouseLeave)
    deleteBtn.addEventListener('click', handleDeleteClick)

    // The uploading placeholder is its own cancel button: a click on it stops
    // the upload, and the failed upload's own clean-up takes the placeholder
    // out. From the keyboard, deleting the placeholder does the same.
    const cancelUploadAt = (node: Element | null) => {
      const placeholder = node?.closest<HTMLElement>('.ql-image-loading')
      const loadingId = placeholder?.dataset.loadingId
      if (!loadingId) return false
      uploadTracker.controllers.get(loadingId)?.abort()
      return true
    }
    const handleUploadClick = (e: MouseEvent) => {
      if (cancelUploadAt(e.target as Element)) e.preventDefault()
    }
    quill.root.addEventListener('click', handleUploadClick)

    return () => {
      // Closing the editor stops what it was still uploading.
      for (const controller of uploadTracker.controllers.values()) controller.abort()
      quill.root.removeEventListener('click', handleUploadClick)
      quill.root.removeEventListener('quill-paste-rejected', handlePasteRejected)
      quill.root.removeEventListener('quill-image-paste', handleImagePaste)
      quill.root.removeEventListener('drop', handleDrop, true)
      quill.root.removeEventListener('mouseover', handleMouseOver)
      quill.root.removeEventListener('mouseleave', handleMouseLeave)
      deleteBtn.removeEventListener('mouseleave', handleDeleteBtnMouseLeave)
      deleteBtn.removeEventListener('click', handleDeleteClick)
      deleteBtn.remove()
      // The picker's list is on document.body, out of this container's reach —
      // clearing the container below would leave it behind on every remount.
      ;(quill.getModule('mention') as undefined | { destroy?: () => void })?.destroy?.()
      container.innerHTML = ''
      editorRef.current = undefined
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Sync value prop (from Ant Design Form.Item) into the editor
  useEffect(() => {
    const quill = editorRef.current
    if (!quill || value === undefined) return

    // Skip if the editor already has this content (avoids cursor jumping)
    if (contentRef.current === value) return

    isInternalChange.current = true
    quill.setContents(quill.clipboard.convert({ html: unwrapVideoFigures(value) }))
    extrasRef.current.onUpdate?.(quill)
    contentRef.current = value
    isInternalChange.current = false
  }, [value])

  const handleFormat = (format: 'bold' | 'italic' | 'underline') => {
    if (!editorRef.current) return

    const quill = editorRef.current

    // Get the saved selection or current selection
    let range = savedSelectionRef.current || quill.getSelection(true)

    // If no selection exists, create one at the end
    if (!range) {
      const length = quill.getLength()
      range = { index: Math.max(0, length - 1), length: 0 }
    }

    // Ensure we have a valid range
    if (range.index < 0) {
      range.index = 0
    }
    if (range.length < 0) {
      range.length = 0
    }

    // Set the selection first
    quill.setSelection(range.index, range.length, 'user')

    // Get current format at the selection
    const currentFormats = quill.getFormat(range)
    const isActive = Boolean(currentFormats[format])

    // Apply or remove the format
    if (range.length > 0) {
      // If text is selected, format the selection
      quill.formatText(range.index, range.length, format, !isActive, 'user')
    } else {
      // If no selection, format at cursor position (will apply to next typed text)
      quill.format(format, !isActive, 'user')
    }

    // Update active state immediately on click (don't wait for Quill events)
    setFormatState(prev => ({ ...prev, [format]: !isActive }))

    // Restore selection and focus
    requestAnimationFrame(() => {
      quill.setSelection(range.index, range.length, 'user')
      const editorElement = quill.root
      if (editorElement && typeof editorElement.focus === 'function') {
        editorElement.focus()
      }
    })
  }

  /**
   * Apply a block format to every line the selection touches.
   *
   * Unlike the inline buttons this cannot run off `onMouseDown` — the select
   * needs that event to open its dropdown — so it works from the selection
   * saved before focus moved to the control.
   */
  const handleHeading = (level: number) => {
    const quill = editorRef.current
    if (!quill) return

    let range = savedSelectionRef.current || quill.getSelection(true)
    if (!range) {
      const length = quill.getLength()
      range = { index: Math.max(0, length - 1), length: 0 }
    }
    if (range.index < 0) range.index = 0
    if (range.length < 0) range.length = 0

    quill.setSelection(range.index, range.length, 'user')
    // `false`, not 0 — Quill treats a falsy-but-numeric level as a level.
    quill.format('header', level === NO_HEADING ? false : level, 'user')
    setFormatState(prev => ({ ...prev, header: level }))

    requestAnimationFrame(() => {
      quill.setSelection(range.index, range.length, 'user')
      quill.root.focus()
    })
  }

  /**
   * Toggle a list or code block on every line the selection touches.
   *
   * Block formats carry a value rather than a flag, so this cannot reuse
   * `handleFormat`: asking for bullets on a line that is already numbered has
   * to switch it, while asking twice has to turn the list off entirely. Both
   * come out of comparing against the value currently in force.
   *
   * `code-block` is read for truthiness instead — Quill stores a language
   * string there once the syntax module is registered, and any of them means
   * the caret is in a code block.
   */
  const handleBlockFormat = (format: 'code-block' | 'list', value: string | true) => {
    const quill = editorRef.current
    if (!quill) return

    let range = savedSelectionRef.current || quill.getSelection(true)
    if (!range) {
      const length = quill.getLength()
      range = { index: Math.max(0, length - 1), length: 0 }
    }
    if (range.index < 0) range.index = 0
    if (range.length < 0) range.length = 0

    quill.setSelection(range.index, range.length, 'user')

    const current = quill.getFormat(range)[format]
    const isActive = format === 'list' ? current === value : Boolean(current)

    quill.format(format, isActive ? false : value, 'user')

    setFormatState(prev =>
      format === 'list'
        ? { ...prev, list: isActive ? NO_LIST : String(value) }
        : { ...prev, codeBlock: !isActive }
    )

    requestAnimationFrame(() => {
      quill.setSelection(range.index, range.length, 'user')
      quill.root.focus()
    })
  }

  /**
   * Remember where the caret is before the dropdown takes focus. The editor's
   * blur reports a null range, which the selection listener ignores, so the ref
   * survives — this only keeps it from going stale on the very first click.
   */
  const rememberSelection = () => {
    const selection = editorRef.current?.getSelection()
    if (selection) savedSelectionRef.current = selection
  }

  const handleLinkButtonClick = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    const quill = editorRef.current
    if (!quill) return

    const selection = quill.getSelection(true)
    if (selection) savedSelectionRef.current = selection

    const range = savedSelectionRef.current || selection
    if (range) {
      const currentFormats = quill.getFormat(range)
      if (currentFormats.link) {
        quill.formatText(range.index, range.length, 'link', false, 'user')
        setFormatState(prev => ({ ...prev, link: false }))
        return
      }
    }

    linkInputRef.current = ''
    setLinkInputValue('')
    setLinkPopoverOpen(true)
    setFormatState(prev => ({ ...prev, link: true }))
  }

  const closeLinkPopover = useCallback(() => {
    setLinkPopoverOpen(false)
    setFormatState(prev => ({ ...prev, link: false }))
  }, [])

  useOutsideDismiss(linkPopoverOpen, linkPopoverParts, closeLinkPopover)

  const applyLink = () => {
    const quill = editorRef.current
    if (!quill) return

    let range = savedSelectionRef.current || quill.getSelection(true)
    if (!range) {
      const length = quill.getLength()
      range = { index: Math.max(0, length - 1), length: 0 }
    }
    if (range.index < 0) range.index = 0
    if (range.length < 0) range.length = 0

    const url = linkInputRef.current.trim()
    if (url) {
      const formattedUrl =
        url.startsWith('http://') || url.startsWith('https://') ? url : `https://${url}`
      if (range.length > 0) {
        quill.formatText(range.index, range.length, 'link', formattedUrl, 'user')
      } else {
        quill.insertText(range.index, url, 'link', formattedUrl, 'user')
        quill.setSelection(range.index + url.length, 0, 'user')
      }
    }

    setLinkPopoverOpen(false)
    setLinkInputValue('')

    requestAnimationFrame(() => {
      quill.setSelection(range.index, range.length, 'user')
      quill.root.focus()
    })
  }

  const handleAttachment = () => {
    const input = document.createElement('input')
    input.setAttribute('type', 'file')
    input.addEventListener('change', () => {
      const file = input.files?.[0]
      if (file) {
        if (onAttachment) {
          onAttachment(file)
        } else if (editorRef.current) {
          // Default behavior: insert image if no handler provided
          const reader = new FileReader()
          reader.addEventListener('load', e => {
            const range = editorRef.current?.getSelection(true)
            if (range && e.target?.result) {
              editorRef.current?.insertEmbed(range.index, 'image', e.target.result as string)
            }
          })
          reader.readAsDataURL(file)
        }
      }
    })
    input.click()
  }

  const isUploadingImage = uploadsInFlight > 0

  /**
   * Open the file picker for a picture or a video and upload what is chosen
   * into the text at the caret.
   */
  const pickMedia = (kind: MediaKind) => {
    const quill = editorRef.current
    const handlerRef = kind === 'video' ? onVideoInsertRef : onImageInsertRef
    const maxRef = kind === 'video' ? maxVideosRef : maxImagesRef
    if (!quill || !handlerRef.current) return
    // Save cursor before file picker steals focus
    const savedRange = quill.getSelection() ?? {
      index: quill.getLength() - 1,
      length: 0
    }
    const input = document.createElement('input')
    input.type = 'file'
    // The video picker offers only the formats the forum takes; the image one
    // keeps the browser's own filter and leaves the allowlist to the upload.
    input.accept = kind === 'video' ? acceptMimeTypes('video') : 'image/*'
    input.addEventListener('change', () => {
      const file = input.files?.[0]
      if (!file || !handlerRef.current) return
      // Restore cursor position before inserting loading blot
      quill.setSelection(savedRange.index, savedRange.length, 'silent')
      triggerMediaUpload(
        quill,
        file,
        kind,
        handlerRef.current,
        error => reportImageError(error, message => setValidationErrors([message])),
        uploadTracker,
        maxRef.current
      )
    })
    input.click()
  }

  const clearContent = () => {
    if (editorRef.current) {
      editorRef.current.setContents([])
      contentRef.current = ''
      setHasContent(false)
    }
  }

  const handleSubmit = () => {
    if (!editorRef.current || !hasSubmittableContent(editorRef.current) || !onSubmitRef.current) return

    // Sending now would post the draft without the picture and leave the
    // finished upload with no placeholder to fill. The button is disabled while
    // this holds, so reaching here means a stray call.
    if (isUploadingImage) return

    const result: ValidationResult = validateContent(contentRef.current, {
      maxImages,
      maxTextLength: maxLength,
      maxVideos
    })
    if (!result.valid) {
      setValidationErrors(result.errors)
      return
    }

    setValidationErrors([])
    onSubmitRef.current(contentRef.current)
    clearContent()
  }

  const showSubmitButton = Boolean(onSubmit)

  /**
   * The paragraph/heading picker.
   *
   * Rendered twice — on the toolbar from md up, inside the overflow menu below
   * it — so the id has to be passed in: two copies sharing one would leave the
   * label pointing at whichever the browser found first.
   */
  const renderHeadingSelect = (id: string, widthClass: string) => (
    <>
      {/* The select shows its value, not its purpose, so it needs a label of
          its own — hidden because the dropdown's contents already make the
          purpose obvious on screen. */}
      <label className="bc-sr-only" htmlFor={id}>
        {__('Text format')}
      </label>
      <Select
        className={`${widthClass} ${styles.headingSelect}`}
        id={id}
        onChange={handleHeading}
        onMouseDown={rememberSelection}
        options={headingOptions}
        popupMatchSelectWidth={false}
        size="small"
        title={__('Text format')}
        value={selectedHeading}
        variant="borderless"
      />
    </>
  )

  /**
   * The block formats, described once and rendered two ways: icon-only buttons
   * on the toolbar, labelled rows in the overflow menu where there is room for
   * words and no hover to reveal a tooltip.
   */
  const blockControls = [
    {
      active: formatState.list === 'bullet',
      icon: <UnorderedListOutlined />,
      label: __('Bulleted list'),
      run: () => handleBlockFormat('list', 'bullet')
    },
    {
      active: formatState.list === 'ordered',
      icon: <OrderedListOutlined />,
      label: __('Numbered list'),
      run: () => handleBlockFormat('list', 'ordered')
    },
    {
      active: formatState.codeBlock,
      icon: <CodeOutlined />,
      label: __('Code block'),
      run: () => handleBlockFormat('code-block', true)
    }
  ]

  /**
   * What the ⋯ button opens on a phone.
   *
   * These rows run off `onClick`, not the `onMouseDown` the toolbar buttons
   * use: the menu has already taken focus by the time one is tapped, so there
   * is no live selection left to preserve. `handleBlockFormat` works from the
   * range saved when the caret last moved, which the ⋯ button refreshes on the
   * way in — so the format still lands on the line the author was writing.
   */
  const moreMenu = (
    <div className={styles.moreMenu}>
      {showHeadings && renderHeadingSelect(menuHeadingSelectId, HEADING_SELECT_MENU_WIDTH)}
      {blockControls.map(control => (
        <Button
          aria-pressed={control.active}
          block
          icon={control.icon}
          key={control.label}
          onClick={() => {
            control.run()
            setMoreOpen(false)
          }}
          type={control.active ? 'primary' : 'text'}
        >
          {control.label}
        </Button>
      ))}
      {onAttachment && (
        <Button
          block
          icon={<PaperClipOutlined />}
          onClick={() => {
            handleAttachment()
            setMoreOpen(false)
          }}
          type="text"
        >
          {__('Attach file')}
        </Button>
      )}
    </div>
  )

  const saveSelectionAndExec = (callback: () => void) => (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (editorRef.current) {
      const selection = editorRef.current.getSelection(true)
      if (selection) {
        savedSelectionRef.current = selection
      }
    }
    callback()
  }

  return (
    <div
      // `overflow-clip` rather than `hidden`: both trim the rounded corners,
      // but `hidden` makes this a scrollport of its own, and a sticky child
      // resolves against the nearest one — which would pin the toolbar to a box
      // that never scrolls, i.e. not at all. See .stickyToolbar.
      className={`bc-relative bc-rounded-lg bc-overflow-clip bc-mb-6 ${extras.wrapperClassName ?? ''} ${className || ''}`}
      style={{ border: `1px solid ${token.colorBorder}` }}
    >
      <div ref={containerRef} />
      {extras.overlay}
      {showToolbar && (
        // The narrower side padding on a phone is what keeps the toolbar to
        // two rows: 16px each side of a 288px comment box is width the
        // controls need more than the edge does.
        <Flex
          align="center"
          className={`bc-px-2 bc-py-2 md:bc-px-4 ${styles.stickyToolbar}`}
          justify="space-between"
        >
          {/* Groups are plain flex rows rather than antd Space: Space wraps
              every child in an item div of its own, and hiding the child
              leaves that wrapper behind to collect a gap. A display:none child
              of a flex row is not a flex item at all, so what the phone hides
              costs no space. Wrapping stays on as a safety net for a group
              that still cannot fit. */}
          <div className="bc-flex bc-flex-wrap bc-items-center bc-gap-2">
            {showHeadings && (
              <div className="bc-hidden bc-items-center bc-gap-1 md:bc-flex">
                {renderHeadingSelect(headingSelectId, HEADING_SELECT_WIDTH)}
              </div>
            )}
            {/* Icon-only controls: each carries an accessible name, and
                aria-pressed exposes the on/off state that the colour alone
                conveys visually. */}
            <div className="bc-flex bc-items-center bc-gap-1">
              <Button
                aria-label={__('Bold')}
                aria-pressed={formatState.bold}
                icon={<BoldOutlined />}
                onMouseDown={saveSelectionAndExec(() => handleFormat('bold'))}
                size="small"
                title={__('Bold')}
                type={formatState.bold ? 'primary' : 'text'}
              />
              <Button
                aria-label={__('Italic')}
                aria-pressed={formatState.italic}
                icon={<ItalicOutlined />}
                onMouseDown={saveSelectionAndExec(() => handleFormat('italic'))}
                size="small"
                title={__('Italic')}
                type={formatState.italic ? 'primary' : 'text'}
              />
              <Button
                aria-label={__('Underline')}
                aria-pressed={formatState.underline}
                icon={<UnderlineOutlined />}
                onMouseDown={saveSelectionAndExec(() => handleFormat('underline'))}
                size="small"
                title={__('Underline')}
                type={formatState.underline ? 'primary' : 'text'}
              />
              <Popover
                arrow={false}
                content={
                  <div className={styles.linkPopoverContent} ref={linkPopoverRef}>
                    <Input
                      onChange={e => {
                        linkInputRef.current = e.target.value
                        setLinkInputValue(e.target.value)
                      }}
                      onKeyDown={e => {
                        if (e.key === 'Enter') applyLink()
                        if (e.key === 'Escape') closeLinkPopover()
                      }}
                      placeholder="Search or type URL"
                      size="middle"
                      suffix={
                        <Flex gap={4}>
                          <Button
                            aria-label={__('Apply link')}
                            className={styles.linkSubmitBtn}
                            icon={<CheckOutlined />}
                            onClick={applyLink}
                            size="small"
                            title={__('Apply link')}
                            type="primary"
                          />
                          <Button
                            aria-label={__('Cancel link')}
                            className={styles.linkSubmitBtn}
                            icon={<CloseOutlined />}
                            onClick={closeLinkPopover}
                            size="small"
                            title={__('Cancel link')}
                          />
                        </Flex>
                      }
                      value={linkInputValue}
                      variant="outlined"
                    />
                  </div>
                }
                onOpenChange={open => {
                  if (!open) closeLinkPopover()
                }}
                open={linkPopoverOpen}
                overlayStyle={{ boxShadow: '0 4px 20px rgba(0,0,0,0.15)' }}
                placement="bottomLeft"
                styles={{ body: { padding: '10px 12px' } }}
                trigger={[]}
              >
                <Button
                  aria-label={__('Insert link')}
                  aria-pressed={formatState.link}
                  icon={<LinkOutlined />}
                  onMouseDown={handleLinkButtonClick}
                  ref={linkButtonRef}
                  size="small"
                  title={__('Insert link')}
                  type={formatState.link ? 'primary' : 'text'}
                />
              </Popover>
              {extras.toolbar}
            </div>
            <div className="bc-hidden bc-items-center bc-gap-1 md:bc-flex">
              {blockControls.map(control => (
                <Button
                  aria-label={control.label}
                  aria-pressed={control.active}
                  icon={control.icon}
                  key={control.label}
                  onMouseDown={saveSelectionAndExec(control.run)}
                  size="small"
                  title={control.label}
                  type={control.active ? 'primary' : 'text'}
                />
              ))}
            </div>
            {(onImageInsert || onVideoInsert) && (
              <div className="bc-flex bc-items-center bc-gap-1">
                {onImageInsert && (
                  <Button
                    aria-label={__('Insert image')}
                    icon={<PictureOutlined />}
                    onClick={() => pickMedia('image')}
                    size="small"
                    title={__('Insert image')}
                    type="text"
                  />
                )}
                {onVideoInsert && (
                  <Button
                    aria-label={__('Upload video')}
                    icon={<VideoCameraAddOutlined />}
                    onClick={() => pickMedia('video')}
                    size="small"
                    title={__('Upload video')}
                    type="text"
                  />
                )}
              </div>
            )}
            {onAttachment && (
              <div className="bc-hidden bc-items-center bc-gap-1 md:bc-flex">
                <Button
                  aria-label={__('Attach file')}
                  icon={<PaperClipOutlined />}
                  onClick={handleAttachment}
                  size="small"
                  title={__('Attach file')}
                  type="text"
                />
              </div>
            )}
            {/* Everything that does not fit a phone's single row. Hidden from
                md up, where all of it sits on the toolbar already. */}
            <div className="bc-flex bc-items-center md:bc-hidden">
              <Popover
                arrow={false}
                content={moreMenu}
                onOpenChange={setMoreOpen}
                open={moreOpen}
                placement="bottomRight"
                styles={{ body: { padding: 6 } }}
                trigger="click"
              >
                <Button
                  aria-expanded={moreOpen}
                  aria-label={__('More formatting')}
                  icon={<EllipsisOutlined />}
                  onMouseDown={rememberSelection}
                  size="small"
                  title={__('More formatting')}
                  type={moreOpen ? 'primary' : 'text'}
                />
              </Popover>
            </div>
          </div>
          {showSubmitButton && (
            <Tooltip
              color="red"
              open={validationErrors.length > 0}
              title={
                <ul className="bc-m-0 bc-pl-4">
                  {validationErrors.map(err => (
                    <li key={err}>{err}</li>
                  ))}
                </ul>
              }
            >
              {/* Held while a picture is still uploading: the placeholder the
                  finished upload swaps out only exists as long as this editor
                  does, so sending early posted the draft without the image.
                  The label says so rather than leaving a dead button. */}
              <Button
                disabled={!hasContent || isUploadingImage}
                icon={validationErrors.length > 0 ? <WarningOutlined /> : ''}
                loading={isUploadingImage}
                onClick={handleSubmit}
                type="primary"
              >
                {submitIconMobile && validationErrors.length === 0 && !isUploadingImage && (
                  <span className="bc-inline-flex md:bc-hidden">{submitIconMobile}</span>
                )}
                <span
                  className={
                    submitIconMobile && !isUploadingImage ? 'bc-hidden md:bc-inline' : undefined
                  }
                >
                  {isUploadingImage ? __('Uploading…') : submitButtonText}
                </span>
              </Button>
            </Tooltip>
          )}
        </Flex>
      )}
      {/* Only once the limit is in sight: a counter on every keystroke of a
          two-line reply is noise. */}
      {maxLength !== undefined && characterCount >= maxLength * COUNTER_THRESHOLD && (
        <Typography.Text
          aria-live="polite"
          className="bc-mt-1 bc-block bc-text-right bc-text-xs"
          type={characterCount > maxLength ? 'danger' : 'secondary'}
        >
          {`${characterCount.toLocaleString()} / ${maxLength.toLocaleString()}`}
        </Typography.Text>
      )}
      {validationErrors.length > 0 && !showSubmitButton && (
        <ul className={styles.validationErrors}>
          {validationErrors.map(err => (
            <li key={err}>{err}</li>
          ))}
        </ul>
      )}
    </div>
  )
}

const QuillEditor = memo(QuillEditorInner)
export default QuillEditor
