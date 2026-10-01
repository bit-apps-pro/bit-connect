import { __ } from '@common/helpers/i18nWrap'
import { type Topic } from '@features/topic-modal/shared/type'
import { type ReactNode } from 'react'
import { LuEyeOff } from 'react-icons/lu'

/** The sentence's own box, at the byline's size. */
export const HIDDEN_NOTICE = 'bc-max-w-[54ch] bc-text-sm bc-leading-relaxed bc-text-ink-muted'

/** The chip that starts the sentence. */
export const HIDDEN_NOTICE_CHIP =
  'bc-mr-1.5 bc-inline-flex bc-items-center bc-gap-1 bc-rounded-full bc-bg-surface-sunken bc-px-2 bc-py-0.5 bc-align-[-2px] bc-text-xs bc-font-medium bc-text-ink'

/**
 * Why a hidden topic is hidden, told to the two people who are shown one.
 *
 * Only the author and a moderator are ever served a hidden topic, so this is
 * the one place either of them can be told why nobody else can find it —
 * without it the author watched their topic disappear from the portal, from
 * their own profile and from its own URL, with nothing saying it had been
 * reported rather than deleted.
 *
 * Under the byline and at the byline's own size, because it belongs to the
 * same set of facts as the date and the edited note: who can see this, and
 * since when. A banner above the title said it three times louder and read as
 * an accusation levelled at the author over a report somebody else filed.
 *
 * A chip carries the state and the sentence carries the consequence. One long
 * bolded sentence said both at once and read as a wall; the chip is scannable
 * at byline size, and the explanation earns its place by answering the only
 * question the author actually has — is my post gone?
 *
 * One text flow rather than a flex row: as flex items the sentence claimed the
 * full width and shouldered the chip onto a line of its own, leaving a label
 * stranded above a paragraph. Inline, the chip simply starts the sentence.
 */
export default function HiddenTopicNotice({
  isOwner,
  post
}: {
  isOwner: boolean
  post: Topic
}): ReactNode {
  if (!post.hidden) return

  return (
    <div className={HIDDEN_NOTICE}>
      <span className={HIDDEN_NOTICE_CHIP}>
        <LuEyeOff size={13} />
        {__('Hidden')}
      </span>
      {isOwner
        ? __(
            'Only you and the moderators can see this while a report is reviewed. Nothing has been deleted.'
          )
        : __('Out of public view while a report is reviewed.')}
    </div>
  )
}
