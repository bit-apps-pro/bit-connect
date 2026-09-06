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
  WarningOutlined
} from '@ant-design/icons'
import { __ } from '@common/helpers/i18nWrap'
import { theme as antdTheme, Button, Flex, Input, Popover, Select, Tooltip } from 'antd'
import Quill from 'quill'
import {
  memo,
  type ReactNode,
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
import { searchMembers } from './mention-source'
import { setImageLoadingProgress } from './quill-image-loading-blot'
import { validateContent, type ValidationResult } from './quill-validation'
import { formatForWordPress } from './quill-wp-formatter'
import styles from './QuillEditor.module.css'

/**
 * Uploads `file` and calls `insertImage` with the resulting URL. `onProgress`
 * is optional — handlers that can report upload progress should call it with
 * 0–100 so the inline placeholder shows how far along the upload is.
 */
type ImageHandler = (
  file: File,
  insertImage: (url: string) => void,
  onProgress?: (percent: number) => void
) => Promise<void> | void

/**
 * Whether there is anything worth submitting.
 *
 * A picture on its own is a legitimate comment — a screenshot of the bug, a
 * photo of the receipt — so an embedded image counts even with no text. The
 * loading placeholder deliberately does not: submitting mid-upload would post
 * a comment whose image never arrives.
 */
function hasSubmittableContent(quill: Quill): boolean {
  if (quill.getText().trim().length > 0) return true

  return quill
    .getContents()
    .ops.some(op => typeof op.insert === 'object' && 'image' in (op.insert as object))
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
function reportImageError(error: Error, showInline: (message: string) => void) {
  console.error('Image upload failed:', error)
  showInline(error.message || 'Image upload failed.')
}

/**
 * Counts the image uploads still in flight for one editor.
 *
 * Submitting during an upload used to lose the picture outright: the editor is
 * cleared (or, when editing a comment, unmounted) the moment the draft is sent,
 * so the placeholder the finished upload looks for is gone and the image is
 * dropped on the floor. The count is what lets the submit button wait.
 */
interface UploadTracker {
  begin: () => void
  end: () => void
}

/**
 * Insert a loading placeholder at the cursor, call the upload handler while
 * feeding progress back into that placeholder, then swap in the real image
 * (or remove the placeholder on error).
 */
function triggerImageUpload(
  quill: Quill,
  file: File,
  handler: ImageHandler,
  onError: (err: Error) => void,
  track: UploadTracker
) {
  const loadingId = `ql-img-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
  const range = quill.getSelection(true)
  quill.insertEmbed(range.index, 'image-loading', loadingId, 'user')
  quill.setSelection(range.index + 1, 0, 'user')

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

  const insertFunction = (url: string) => {
    const idx = findIdx()
    if (idx >= 0) {
      quill.deleteText(idx, 1, 'user')
      quill.insertEmbed(idx, 'image', url, 'user')
      quill.setSelection(idx + 1, 0, 'user')
    }
  }

  const reportProgress = (percent: number) => setImageLoadingProgress(quill.root, loadingId, percent)

  track.begin()
  Promise.resolve(handler(file, insertFunction, reportProgress))
    .catch((error: Error) => {
      const idx = findIdx()
      if (idx >= 0) quill.deleteText(idx, 1, 'user')
      onError(error)
    })
    .finally(() => track.end())
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

/** Fixed so the control does not resize as the selected level changes. */
const HEADING_SELECT_WIDTH = 'bc-w-[124px]'

/** In the overflow menu it spans the row, like every other item there. */
const HEADING_SELECT_MENU_WIDTH = 'bc-w-full'

interface QuillEditorProps {
  className?: string
  defaultValue?: string
  /** Opt-out: typing "@" offers the member list. On everywhere the portal
   *  composes forum content, because a mention is how you bring a colleague
   *  into a thread — an editor without it leaves the notification with no way
   *  to be raised. Off is for editors whose text is not a conversation. */
  mentions?: boolean
  onAttachment?: (file: File) => void
  onChange?: (html: string) => void
  onImageInsert?: ImageHandler
  onImagePaste?: ImageHandler
  onSubmit?: (html: string) => void
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
  mentions = true,
  onAttachment,
  onChange,
  onImageInsert,
  onImagePaste,
  onSubmit,
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
      quill.setContents(quill.clipboard.convert({ html: defaultValueRef.current }))
    }

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
      // Format immediately so the value stored in state and passed to onChange
      // is already WordPress-compatible HTML — no further transformation needed
      // at submit time or on the backend read path.
      const html = formatForWordPress(quill.getSemanticHTML())
      contentRef.current = html

      const newHasContent = hasSubmittableContent(quill)
      setHasContent(prev => (prev === newHasContent ? prev : newHasContent))

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
      triggerImageUpload(
        quill,
        file,
        onImagePasteRef.current,
        error => reportImageError(error, message => setValidationErrors([message])),
        uploadTracker
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

    // Floating delete button shown when hovering over an inline image
    const deleteBtn = document.createElement('button')
    deleteBtn.className = styles.imageDeleteBtn
    deleteBtn.setAttribute('type', 'button')
    deleteBtn.setAttribute('aria-label', 'Remove image')
    deleteBtn.innerHTML =
      '<svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>'
    document.body.append(deleteBtn)

    let hoveredImg: HTMLImageElement | null = null

    const showDeleteBtn = (img: HTMLImageElement) => {
      hoveredImg = img
      const rect = img.getBoundingClientRect()
      deleteBtn.style.display = 'flex'
      deleteBtn.style.top = `${rect.top + 6}px`
      deleteBtn.style.left = `${rect.right - 30}px`
    }

    const hideDeleteBtn = () => {
      hoveredImg = null
      deleteBtn.style.display = 'none'
    }

    const handleMouseOver = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      if (target.tagName === 'IMG') showDeleteBtn(target as HTMLImageElement)
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
      if (!hoveredImg) return
      const source = hoveredImg.getAttribute('src')
      if (source) {
        let i = 0
        for (const op of quill.getContents().ops) {
          if (typeof op.insert === 'object' && (op.insert as Record<string, unknown>).image === source) {
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

    return () => {
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
    quill.setContents(quill.clipboard.convert({ html: value }))
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

    const result: ValidationResult = validateContent(contentRef.current)
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
      className={`bc-relative bc-rounded-lg bc-overflow-clip bc-mb-6 ${className || ''}`}
      style={{ border: `1px solid ${token.colorBorder}` }}
    >
      <div ref={containerRef} />
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
                  <div className={styles.linkPopoverContent}>
                    <Input
                      onChange={e => {
                        linkInputRef.current = e.target.value
                        setLinkInputValue(e.target.value)
                      }}
                      onKeyDown={e => {
                        if (e.key === 'Enter') applyLink()
                        if (e.key === 'Escape') setLinkPopoverOpen(false)
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
                            onClick={() => setLinkPopoverOpen(false)}
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
                  if (!open) {
                    setLinkPopoverOpen(false)
                    setFormatState(prev => ({ ...prev, link: false }))
                  }
                }}
                open={linkPopoverOpen}
                overlayInnerStyle={{ padding: '10px 12px' }}
                overlayStyle={{ boxShadow: '0 4px 20px rgba(0,0,0,0.15)' }}
                placement="bottomLeft"
                trigger={[]}
              >
                <Button
                  aria-label={__('Insert link')}
                  aria-pressed={formatState.link}
                  icon={<LinkOutlined />}
                  onMouseDown={handleLinkButtonClick}
                  size="small"
                  title={__('Insert link')}
                  type={formatState.link ? 'primary' : 'text'}
                />
              </Popover>
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
            {onImageInsert && (
              <div className="bc-flex bc-items-center bc-gap-1">
                <Button
                  aria-label={__('Insert image')}
                  icon={<PictureOutlined />}
                  onClick={() => {
                    const quill = editorRef.current
                    if (!quill || !onImageInsertRef.current) return
                    // Save cursor before file picker steals focus
                    const savedRange = quill.getSelection() ?? {
                      index: quill.getLength() - 1,
                      length: 0
                    }
                    const input = document.createElement('input')
                    input.type = 'file'
                    input.accept = 'image/*'
                    input.addEventListener('change', () => {
                      const file = input.files?.[0]
                      if (!file || !onImageInsertRef.current) return
                      // Restore cursor position before inserting loading blot
                      quill.setSelection(savedRange.index, savedRange.length, 'silent')
                      triggerImageUpload(
                        quill,
                        file,
                        onImageInsertRef.current,
                        error => reportImageError(error, message => setValidationErrors([message])),
                        uploadTracker
                      )
                    })
                    input.click()
                  }}
                  size="small"
                  title={__('Insert image')}
                  type="text"
                />
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
                overlayInnerStyle={{ padding: 6 }}
                placement="bottomRight"
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
