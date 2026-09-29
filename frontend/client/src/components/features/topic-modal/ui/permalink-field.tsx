import { __ } from '@common/helpers/i18nWrap'
import { slugify } from '@utils/slug'
import { Button, Input, Spin } from 'antd'
import { type ChangeEvent, type FocusEvent, type KeyboardEvent, type ReactNode, useCallback, useRef } from 'react'
import { LuCheck, LuInfo, LuLink2, LuX } from 'react-icons/lu'

import useSlugAvailability from '../data/use-slug-availability'

interface PermalinkFieldProps {
  /** Form.Item hands this down; whatever carries it is what its label points at. */
  id?: string
  isEditMode?: boolean
  isOpen?: boolean
  /** antd wires these two — the field is a controlled Form.Item child. */
  onChange?: (value: string) => void
  /** Owned by the form, which needs it to decide whether to render a label at all. */
  onOpenChange?: (isOpen: boolean) => void
  /** Fires the first time the author types in here, so the title stops driving the slug. */
  onUserEdit?: () => void
  /** The topic being edited, so its own slug is not reported as a clash. */
  topicId?: number
  value?: string
}

/**
 * The topic's slug, out of the way until someone asks for it.
 *
 * Most authors want the slug their title gives them and should never have to
 * think about one — so nothing is shown but a link to open it. The few who do
 * care still have it one click away.
 *
 * Availability is advisory. A taken slug is reported, never rejected: the save
 * always succeeds, and a clash simply lands on the `-2` the notice names. That
 * matches what the server does and survives two authors saving at once, which
 * no amount of pre-checking can prevent.
 */
export default function PermalinkField({
  id,
  isEditMode,
  isOpen,
  onChange,
  onOpenChange,
  onUserEdit,
  topicId,
  value = ''
}: PermalinkFieldProps) {
  // What to put back if the author changes their mind. Captured on open rather
  // than on every change, so Cancel undoes the whole editing session.
  const openedWith = useRef('')

  const { isAvailable, isChecking, resolved } = useSlugAvailability(isOpen ? value : '', topicId)

  const handleOpen = useCallback(() => {
    openedWith.current = value
    onOpenChange?.(true)
  }, [onOpenChange, value])

  const handleCancel = useCallback(() => {
    onChange?.(openedWith.current)
    onOpenChange?.(false)
  }, [onChange, onOpenChange])

  const handleDone = useCallback(() => {
    const normalized = slugify(value)
    // Nothing sluggable in it — the Form.Item's own rule is already showing why.
    // Collapsing here would hide the input that error points at.
    if (value && !normalized) return

    onChange?.(normalized)
    onOpenChange?.(false)
  }, [onChange, onOpenChange, value])

  const handleChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      onUserEdit?.()
      onChange?.(e.target.value)
    },
    [onChange, onUserEdit]
  )

  // Normalise on leaving the field rather than per keystroke, which would eat
  // the hyphen the moment it is typed.
  const handleBlur = useCallback(
    (e: FocusEvent<HTMLInputElement>) => {
      const normalized = slugify(e.target.value)
      // Input with nothing sluggable in it is left exactly as typed. Blanking
      // it would quietly reinterpret "I typed something unusable" as "derive
      // one from the title", and leave the field's own rule nothing to object
      // to — the author would never learn their slug was thrown away.
      if (!normalized) return
      if (normalized !== e.target.value) onChange?.(normalized)
    },
    [onChange]
  )

  // Enter confirms rather than submitting the whole topic from a half-edited
  // slug; Escape backs out of the slug alone rather than closing the modal.
  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        e.preventDefault()
        handleDone()
      } else if (e.key === 'Escape') {
        e.preventDefault()
        e.stopPropagation()
        handleCancel()
      }
    },
    [handleCancel, handleDone]
  )

  const slug = slugify(value)

  if (!isOpen) {
    // Nothing to preview yet — a new topic with no title.
    if (!value) {
      return (
        // Sized and coloured as the title's helper text, not as an action: it is
        // an aside for the few authors who want it, and a blue link on its own
        // row reads as something everyone is expected to deal with.
        <Button
          className="bc-h-auto bc-p-0 bc-text-xs bc-font-normal bc-text-ink-muted hover:bc-text-primary"
          icon={<LuLink2 size={12} />}
          id={id}
          onClick={handleOpen}
          size="small"
          type="link"
        >
          {__('Set a custom permalink')}
        </Button>
      )
    }

    // The slug the topic will get, as WordPress shows it under a post title —
    // the slug alone, since that is the only part the author can change.
    return (
      <div className="bc-flex bc-min-w-0 bc-items-center bc-gap-1.5 bc-text-xs bc-text-ink-muted">
        <LuLink2 className="bc-shrink-0" size={12} />
        <span className="bc-min-w-0 bc-truncate bc-font-medium bc-text-ink" title={value}>
          {value}
        </span>
        <Button
          aria-label={__('Edit permalink')}
          className="bc-h-auto bc-shrink-0 bc-p-0 bc-text-xs"
          id={id}
          onClick={handleOpen}
          size="small"
          type="link"
        >
          {__('Edit')}
        </Button>
      </div>
    )
  }

  return (
    <div className="bc-flex bc-flex-col bc-gap-1.5">
      <Input
        // eslint-disable-next-line jsx-a11y/no-autofocus -- the input exists because the author just asked for it
        autoFocus
        id={id}
        maxLength={200}
        onBlur={handleBlur}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        placeholder={__('topic-slug')}
        // Confirm and cancel live inside the field, as an inline edit's do:
        // they act on this one value, not the form, and a row of full-size
        // buttons beside the modal's own Submit/Cancel read as a second form.
        suffix={
          <span className="bc-flex bc-items-center bc-gap-0.5">
            <SlugAction label={__('Cancel')} onClick={handleCancel}>
              <LuX size={15} />
            </SlugAction>
            <SlugAction className="bc-text-primary" label={__('Done')} onClick={handleDone}>
              <LuCheck size={15} />
            </SlugAction>
          </span>
        }
        value={value}
      />

      {/* One line under the input: the verdict once there is a slug to judge,
          the fallback before. Editing a published topic always carries the
          warning, since that is the moment it matters. */}
      <SlugStatus isAvailable={isAvailable} isChecking={isChecking} resolved={resolved} slug={slug} />
      {(isEditMode || !slug) && (
        <span className="bc-text-xs bc-text-ink-subtle">
          {isEditMode
            ? __('Links that already point at this topic will stop working.')
            : __('Leave blank to build one from the title.')}
        </span>
      )}
    </div>
  )
}

/**
 * One of the icon buttons inside the slug input. Keeps focus in the input on
 * press, so clicking one does not first blur the field and normalise the slug
 * under the author's cursor.
 */
function SlugAction({
  children,
  className = 'bc-text-ink-muted',
  label,
  onClick
}: {
  children: ReactNode
  className?: string
  label: string
  onClick: () => void
}) {
  return (
    <Button
      aria-label={label}
      className={`bc-h-6 bc-w-6 bc-min-w-0 bc-p-0 ${className}`}
      icon={children}
      onClick={onClick}
      onMouseDown={e => e.preventDefault()}
      size="small"
      title={label}
      type="text"
    />
  )
}

function SlugStatus({
  isAvailable,
  isChecking,
  resolved,
  slug
}: {
  isAvailable: boolean
  isChecking: boolean
  resolved: string
  slug: string
}) {
  if (!slug) return

  if (isChecking) {
    return (
      <span className="bc-flex bc-items-center bc-gap-1.5 bc-text-xs bc-text-ink-subtle">
        <Spin size="small" />
        {__('Checking availability…')}
      </span>
    )
  }

  if (isAvailable) {
    return (
      <span className="bc-flex bc-items-center bc-gap-1.5 bc-text-xs bc-text-positive">
        <LuCheck size={13} />
        {__('Available')}
      </span>
    )
  }

  // Deliberately not an error: the save is not blocked, and naming the slug it
  // will land on is the whole point of checking early.
  return (
    <span className="bc-flex bc-items-start bc-gap-1.5 bc-text-xs bc-text-info">
      <LuInfo className="bc-mt-0.5 bc-shrink-0" size={13} />
      <span>
        {__('Already taken — this topic will be saved as')} <strong>{resolved}</strong>
      </span>
    </span>
  )
}
